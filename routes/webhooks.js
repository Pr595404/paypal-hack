/**
 * routes/webhooks.js — PayPal Webhook Receiver
 *
 * Receives webhook events from PayPal, verifies signatures,
 * deduplicates events, and updates invoice statuses.
 */
const express = require('express');
const router = express.Router();
const db = require('../db/pool');
const paypal = require('../lib/paypal-client');

/**
 * POST /webhooks/paypal — Receive PayPal webhook events
 *
 * NOTE: This route receives raw body (Buffer) because
 * server.js uses express.raw() specifically for this path.
 */
router.post('/paypal', async (req, res) => {
  try {
    const rawBody = req.body; // Buffer (from express.raw)
    const headers = req.headers;

    // 1. Parse the event
    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch (parseErr) {
      console.error('[Webhook] Invalid JSON body');
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    console.log('[Webhook] Received:', event.event_type, '| ID:', event.id);

    // 2. Verify signature (skip in dev if no WEBHOOK_ID)
    if (process.env.PAYPAL_WEBHOOK_ID) {
      try {
        const isValid = await paypal.verifyWebhookSignature(headers, rawBody);
        if (!isValid) {
          console.warn('[Webhook] Signature verification FAILED — rejecting event');
          return res.status(401).json({ error: 'Invalid webhook signature' });
        }
      } catch (verifyErr) {
        console.error('[Webhook] Signature verification error:', verifyErr.message);
        // In sandbox, simulator events fail verification — log but continue
        if (process.env.NODE_ENV === 'production') {
          return res.status(401).json({ error: 'Signature verification failed' });
        }
        console.warn('[Webhook] Continuing despite verify error (sandbox mode)');
      }
    }

    // 3. Deduplicate on external event ID
    const existingEvent = await db.query(
      'SELECT id FROM events WHERE external_id = $1',
      [event.id]
    );
    if (existingEvent.rows.length > 0) {
      console.log('[Webhook] Duplicate event, skipping:', event.id);
      return res.status(200).json({ status: 'duplicate', event_id: event.id });
    }

    // 4. Extract invoice info from webhook resource
    const resource = event.resource || {};
    const paypalInvoiceId = resource.id || null;
    const eventType = event.event_type;

    // Find our local invoice by PayPal invoice ID
    let localInvoice = null;
    if (paypalInvoiceId) {
      const invoiceResult = await db.query(
        'SELECT * FROM invoices WHERE paypal_invoice_id = $1',
        [paypalInvoiceId]
      );
      if (invoiceResult.rows.length > 0) {
        localInvoice = invoiceResult.rows[0];
      }
    }

    // 5. Insert the event
    const eventResult = await db.query(`
      INSERT INTO events (invoice_id, type, external_id, payload)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      localInvoice?.id || null,
      `webhook.${eventType}`,
      event.id,
      JSON.stringify(event),
    ]);

    // 6. Process status update based on event type
    if (localInvoice) {
      const statusMap = {
        'INVOICING.INVOICE.PAID': 'paid',
        'INVOICING.INVOICE.CANCELLED': 'cancelled',
        'INVOICING.INVOICE.SENT': 'sent',
        'INVOICING.INVOICE.REFUNDED': 'refunded',
      };

      const newStatus = statusMap[eventType];
      if (newStatus) {
        await db.query(
          'UPDATE invoices SET status = $1, updated_at = now() WHERE id = $2',
          [newStatus, localInvoice.id]
        );
        console.log('[Webhook] Updated invoice', localInvoice.invoice_number, '→', newStatus);
      }
    }

    // 7. Respond 200 OK to acknowledge receipt
    res.status(200).json({
      status: 'received',
      event_id: event.id,
      event_type: eventType,
      local_invoice_id: localInvoice?.id || null,
    });
  } catch (err) {
    console.error('[Webhook] Processing error:', err.message);
    // Always return 200 to prevent PayPal from retrying
    res.status(200).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
