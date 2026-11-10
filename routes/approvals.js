/**
 * routes/approvals.js — Approval & Audit API with Demo Mode Fallback
 */
const express = require('express');
const router = express.Router();
const db = require('../db/pool');
const guard = require('../lib/guard');

const DEMO_APPROVALS = [
  {
    id: 101,
    invoice_id: 3,
    invoice_number: "INV-2026-003",
    action_type: "send_invoice",
    amount: "4200.00",
    currency: "USD",
    invoice_status: "pending_approval",
    client_name: "Tokyo AI Robotics Labs",
    client_email: "tanaka@tokyoailabs.jp",
    client_trusted: false,
    status: "pending",
    reasoning: "First-time international client with contract > $4,000 threshold. Guard held for manual authorization.",
    created_at: new Date().toISOString()
  }
];

const DEMO_AUDIT = [
  {
    id: 201,
    proposed_action_id: 101,
    decision: "escalated",
    reason: "Untrusted client Tokyo AI Robotics Labs amount $4,200 exceeds safety threshold. Held for human review.",
    actor: "guard",
    created_at: new Date().toISOString()
  }
];

/**
 * GET /api/approvals — List pending proposed actions
 */
router.get('/', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const result = await db.query(`
      SELECT pa.*, i.invoice_number, i.amount, i.currency, i.status as invoice_status,
             i.due_date, c.name as client_name, c.email as client_email, c.trusted as client_trusted
      FROM proposed_actions pa
      JOIN invoices i ON pa.invoice_id = i.id
      JOIN clients c ON i.client_id = c.id
      WHERE pa.status = $1
      ORDER BY pa.created_at DESC
    `, [status]);

    res.json({ approvals: result.rows });
  } catch (err) {
    console.warn('[Approvals] Database unavailable, returning demo fallback:', err.message);
    res.json({ approvals: DEMO_APPROVALS, demoMode: true });
  }
});

/**
 * GET /api/approvals/all — List all proposed actions (any status)
 */
router.get('/all', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT pa.*, i.invoice_number, i.amount, i.currency, i.status as invoice_status,
             c.name as client_name
      FROM proposed_actions pa
      JOIN invoices i ON pa.invoice_id = i.id
      JOIN clients c ON i.client_id = c.id
      ORDER BY pa.created_at DESC
      LIMIT 50
    `);
    res.json({ approvals: result.rows });
  } catch (err) {
    res.json({ approvals: DEMO_APPROVALS, demoMode: true });
  }
});

/**
 * POST /api/approvals/:id/approve — Approve a proposed action
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const result = await guard.processApproval(
      parseInt(req.params.id),
      'approve',
      req.body.reason || 'Approved by user'
    );
    res.json({ result });
  } catch (err) {
    console.warn('[Approvals] Direct execution error or offline DB; returning mock approval response:', err.message);
    res.json({
      result: {
        decision: 'approved',
        reason: 'Action approved in demo mode.',
        action_id: req.params.id,
        demoMode: true,
      }
    });
  }
});

/**
 * POST /api/approvals/:id/reject — Reject a proposed action
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const result = await guard.processApproval(
      parseInt(req.params.id),
      'reject',
      req.body.reason || 'Rejected by user'
    );
    res.json({ result });
  } catch (err) {
    res.json({
      result: {
        decision: 'rejected',
        reason: req.body.reason || 'Manually rejected by user',
        action_id: req.params.id,
        demoMode: true,
      }
    });
  }
});

/**
 * GET /api/approvals/audit — Audit trail
 */
router.get('/audit', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT al.*, pa.action_type, pa.invoice_id,
             i.invoice_number, i.amount, i.currency,
             c.name as client_name
      FROM audit_log al
      JOIN proposed_actions pa ON al.proposed_action_id = pa.id
      JOIN invoices i ON pa.invoice_id = i.id
      JOIN clients c ON i.client_id = c.id
      ORDER BY al.created_at DESC
      LIMIT 100
    `);
    res.json({ audit: result.rows });
  } catch (err) {
    res.json({ audit: DEMO_AUDIT, demoMode: true });
  }
});

module.exports = router;
