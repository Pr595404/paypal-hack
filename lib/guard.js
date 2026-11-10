/**
 * lib/guard.js — Approval Guard & Policy Engine
 *
 * Plain code — NO LLM. Evaluates proposed actions against policies,
 * writes decisions to audit_log, and executes approved actions via PayPal client.
 *
 * RULES:
 * - AI never calls PayPal directly
 * - Guard is the ONLY path to PayPal execution
 * - Every decision is logged to audit_log
 * - Idempotency keys prevent duplicate execution
 */

const db = require('../db/pool');
const paypal = require('./paypal-client');
const crypto = require('crypto');

// Policy configuration
const CURRENCY_ALLOWLIST = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD'];
const UNTRUSTED_AMOUNT_THRESHOLD = 5000; // Hold for manual approval if untrusted + above this
const MAX_REMINDERS_PER_24H = 2;

// Valid status transitions
const VALID_TRANSITIONS = {
  draft: ['sent', 'cancelled'],
  sent: ['viewed', 'paid', 'overdue', 'cancelled'],
  viewed: ['paid', 'overdue', 'cancelled'],
  overdue: ['paid', 'cancelled'],
  pending_approval: ['sent', 'cancelled'],
};

/**
 * Evaluate a proposed action against all policies.
 * @param {Object} action - { action_type, params, invoice_id }
 * @param {Object} invoice - Full invoice row
 * @param {Object} client - Full client row
 * @returns {Promise<{decision: string, reason: string}>}
 */
async function evaluateProposal(action, invoice, client) {
  const checks = [];

  if (!invoice || !client) {
    return reject('Missing invoice or client data. Fail closed.');
  }

  if (!Number.isFinite(Number(invoice.amount)) || Number(invoice.amount) <= 0) {
    return reject(`Invalid invoice amount: ${invoice.amount}. Amount must be greater than zero.`);
  }

  // 1. Currency allowlist
  if (!CURRENCY_ALLOWLIST.includes(invoice.currency)) {
    return reject(`Currency ${invoice.currency} is not in the allowlist: ${CURRENCY_ALLOWLIST.join(', ')}`);
  }
  checks.push('currency_ok');

  // 2. Client trust + amount threshold
  if (!client.trusted && Number(invoice.amount) > UNTRUSTED_AMOUNT_THRESHOLD) {
    return escalate(`Untrusted client "${client.name}" with invoice amount ${invoice.currency} ${invoice.amount} exceeds threshold of ${UNTRUSTED_AMOUNT_THRESHOLD}. Requires manual approval.`);
  }
  checks.push('trust_ok');

  // 3. Duplicate idempotency key
  if (action.idempotency_key) {
    const existing = await db.query(
      'SELECT id FROM proposed_actions WHERE idempotency_key = $1 AND status = $2',
      [action.idempotency_key, 'executed']
    );
    if (existing.rows.length > 0) {
      return reject(`Duplicate idempotency key: ${action.idempotency_key} was already executed.`);
    }
  }
  checks.push('idempotency_ok');

  // 4. Action-specific checks
  if (action.action_type === 'send_invoice') {
    // Can only send drafts or pending_approval
    const allowedFrom = ['draft', 'pending_approval'];
    if (!allowedFrom.includes(invoice.status)) {
      return reject(`Cannot send invoice in status "${invoice.status}". Must be draft or pending_approval.`);
    }
    checks.push('status_transition_ok');
  }

  if (action.action_type === 'send_reminder') {
    // Can only remind sent or overdue invoices
    if (!['sent', 'overdue'].includes(invoice.status)) {
      return reject(`Cannot send reminder for invoice in status "${invoice.status}". Must be sent or overdue.`);
    }
    // Check reminder cap (max 2 per 24h)
    const recentReminders = await db.query(
      `SELECT COUNT(*) as cnt FROM audit_log al
       JOIN proposed_actions pa ON al.proposed_action_id = pa.id
       WHERE pa.invoice_id = $1 AND pa.action_type = 'send_reminder'
       AND al.decision = 'approved' AND al.created_at > now() - interval '24 hours'`,
      [invoice.id]
    );
    if (parseInt(recentReminders.rows[0].cnt) >= MAX_REMINDERS_PER_24H) {
      return reject(`Reminder cap reached: ${MAX_REMINDERS_PER_24H} reminders already sent in the last 24 hours.`);
    }
    checks.push('reminder_cap_ok');
  }

  if (action.action_type === 'cancel_invoice') {
    const cancellable = ['draft', 'sent', 'overdue', 'pending_approval'];
    if (!cancellable.includes(invoice.status)) {
      return reject(`Cannot cancel invoice in status "${invoice.status}".`);
    }
    checks.push('cancel_ok');
  }

  // All checks passed
  return { decision: 'approved', reason: `All policy checks passed: ${checks.join(', ')}` };
}

/**
 * Execute an approved action via PayPal.
 * @param {Object} action - The proposed action row
 * @param {Object} invoice - The invoice row
 * @returns {Promise<Object>} Execution result
 */
async function executeApproved(action, invoice) {
  const idemKey = action.idempotency_key || crypto.randomUUID();

  switch (action.action_type) {
    case 'send_invoice': {
      // Step 1: Create on PayPal if not yet created
      let paypalId = invoice.paypal_invoice_id;
      if (!paypalId) {
        // Need client info for PayPal
        const clientResult = await db.query('SELECT * FROM clients WHERE id = $1', [invoice.client_id]);
        const client = clientResult.rows[0];

        const ppInvoice = await paypal.createInvoice({
          invoice_number: invoice.invoice_number,
          currency: invoice.currency,
          due_date: invoice.due_date,
          issue_date: invoice.issue_date,
          client_email: client.email,
          client_name: client.name,
          items: invoice.line_items,
          notes: invoice.notes,
        }, idemKey);

        paypalId = ppInvoice.id;
        await db.query(
          'UPDATE invoices SET paypal_invoice_id = $1, updated_at = now() WHERE id = $2',
          [paypalId, invoice.id]
        );
      }

      // Step 2: Send
      await paypal.sendInvoice(paypalId);
      await db.query(
        "UPDATE invoices SET status = 'sent', updated_at = now() WHERE id = $1",
        [invoice.id]
      );

      return { success: true, paypal_invoice_id: paypalId, new_status: 'sent' };
    }

    case 'send_reminder': {
      if (!invoice.paypal_invoice_id) {
        throw new Error('Cannot send reminder — invoice has no PayPal ID');
      }
      const note = action.params?.note || 'Friendly reminder regarding your pending balance.';
      await paypal.sendReminder(invoice.paypal_invoice_id, note);
      return { success: true, action: 'reminder_sent' };
    }

    case 'cancel_invoice': {
      if (invoice.paypal_invoice_id) {
        const reason = action.params?.reason || 'Invoice cancelled by PayPilot.';
        await paypal.cancelInvoice(invoice.paypal_invoice_id, reason);
      }
      await db.query(
        "UPDATE invoices SET status = 'cancelled', updated_at = now() WHERE id = $1",
        [invoice.id]
      );
      return { success: true, new_status: 'cancelled' };
    }

    default:
      throw new Error(`Unknown action type: ${action.action_type}`);
  }
}

/**
 * Full pipeline: evaluate → log → execute if approved.
 * @param {number} proposedActionId - ID from proposed_actions table
 * @param {string} humanDecision - 'approve' or 'reject' (from user)
 * @param {string} [humanReason] - Optional reason from user
 */
async function processApproval(proposedActionId, humanDecision, humanReason) {
  // Load the proposed action with invoice and client
  const actionResult = await db.query(
    `SELECT pa.*, i.*, c.name as client_name, c.email as client_email,
            c.trusted as client_trusted, c.currency as client_currency, c.country as client_country
     FROM proposed_actions pa
     JOIN invoices i ON pa.invoice_id = i.id
     JOIN clients c ON i.client_id = c.id
     WHERE pa.id = $1`,
    [proposedActionId]
  );

  if (actionResult.rows.length === 0) {
    throw new Error(`Proposed action ${proposedActionId} not found`);
  }

  const row = actionResult.rows[0];
  const action = {
    id: row.id,
    action_type: row.action_type,
    params: row.params,
    idempotency_key: row.idempotency_key,
    invoice_id: row.invoice_id,
  };
  const invoice = {
    id: row.invoice_id,
    invoice_number: row.invoice_number,
    client_id: row.client_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    due_date: row.due_date,
    issue_date: row.issue_date,
    line_items: row.line_items,
    notes: row.notes,
    paypal_invoice_id: row.paypal_invoice_id,
  };
  const client = {
    id: row.client_id,
    name: row.client_name,
    email: row.client_email,
    trusted: row.client_trusted,
    currency: row.client_currency,
    country: row.client_country,
  };

  if (humanDecision === 'reject') {
    // Human rejected
    await db.query(
      "UPDATE proposed_actions SET status = 'rejected', decided_at = now() WHERE id = $1",
      [proposedActionId]
    );
    await logAudit(proposedActionId, 'rejected', humanReason || 'Manually rejected by user', {});
    return { decision: 'rejected', reason: humanReason };
  }

  // Human approved — run guard policy checks
  const guardResult = await evaluateProposal(action, invoice, client);

  if (guardResult.decision !== 'approved') {
    // Guard overruled the human approval
    await db.query(
      `UPDATE proposed_actions SET status = $1, decided_at = now() WHERE id = $2`,
      [guardResult.decision === 'escalated' ? 'pending' : 'rejected', proposedActionId]
    );
    await logAudit(proposedActionId, guardResult.decision, guardResult.reason, {
      checks_run: true,
      human_approved: true,
      guard_overruled: true,
    });
    return guardResult;
  }

  // Guard approved — execute
  try {
    const execResult = await executeApproved(action, invoice);
    await db.query(
      "UPDATE proposed_actions SET status = 'executed', decided_at = now() WHERE id = $1",
      [proposedActionId]
    );
    await logAudit(proposedActionId, 'approved', guardResult.reason, {
      execution_result: execResult,
    });
    return { decision: 'approved', reason: guardResult.reason, execution: execResult };
  } catch (execErr) {
    await db.query(
      "UPDATE proposed_actions SET status = 'failed', decided_at = now() WHERE id = $1",
      [proposedActionId]
    );
    await logAudit(proposedActionId, 'approved', `Approved but execution failed: ${execErr.message}`, {
      error: execErr.message,
    });
    throw execErr;
  }
}

/**
 * Write a decision to audit_log.
 */
async function logAudit(proposedActionId, decision, reason, policySnapshot) {
  await db.query(
    `INSERT INTO audit_log (proposed_action_id, decision, reason, policy_snapshot, actor)
     VALUES ($1, $2, $3, $4, 'guard')`,
    [proposedActionId, decision, reason, JSON.stringify(policySnapshot)]
  );
}

function reject(reason) {
  return { decision: 'rejected', reason };
}

function escalate(reason) {
  return { decision: 'escalated', reason };
}

module.exports = { evaluateProposal, executeApproved, processApproval };
