/**
 * routes/invoices.js — Invoice CRUD API with Demo Mode Fallback
 */
const express = require('express');
const router = express.Router();
const db = require('../db/pool');
const crypto = require('crypto');

// Resilient demo invoices when PostgreSQL is not configured / connected
const DEMO_INVOICES = [
  {
    id: 1,
    invoice_number: "INV-2026-001",
    client_id: 1,
    client_name: "Vanguard Tech Inc.",
    client_email: "alice@vanguardtech.io",
    client_currency: "USD",
    client_country: "United States",
    client_trusted: true,
    amount: "5850.00",
    currency: "USD",
    status: "paid",
    due_date: "2026-11-01",
    issue_date: "2026-10-15",
    tax_rate: "0.00",
    discount: "150.00",
    line_items: [
      { description: "Cross-Border Agent Architecture", qty: 35, price: 120 },
      { description: "PayPal Webhook & Ledger Sync Setup", qty: 15, price: 120 }
    ],
    notes: "Settled via PayPal Sandbox checkout."
  },
  {
    id: 2,
    invoice_number: "INV-2026-002",
    client_id: 2,
    client_name: "Nordic Design Studio Oy",
    client_email: "marcus@nordicstudio.fi",
    client_currency: "EUR",
    client_country: "Finland",
    client_trusted: true,
    amount: "4730.00",
    currency: "EUR",
    status: "sent",
    due_date: "2026-11-15",
    issue_date: "2026-10-28",
    tax_rate: "0.10",
    discount: "0.00",
    line_items: [
      { description: "FinTech Design Sprint & UX Tokens", qty: 1, price: 3200 },
      { description: "Mobile Responsive Component Library", qty: 1, price: 1100 }
    ],
    notes: "Payment due within 14 days of issue."
  },
  {
    id: 3,
    invoice_number: "INV-2026-003",
    client_id: 3,
    client_name: "Tokyo AI Robotics Labs",
    client_email: "tanaka@tokyoailabs.jp",
    client_currency: "USD",
    client_country: "Japan",
    client_trusted: false,
    amount: "4200.00",
    currency: "USD",
    status: "pending_approval",
    due_date: "2026-11-25",
    issue_date: "2026-11-04",
    tax_rate: "0.00",
    discount: "0.00",
    line_items: [
      { description: "Autonomous AI Cash-Flow Modeling Module", qty: 1, price: 4200 }
    ],
    notes: "First engagement for Tokyo AI Labs. Guard held for policy review."
  },
  {
    id: 4,
    invoice_number: "INV-2026-004",
    client_id: 4,
    client_name: "Apex Growth Advisory",
    client_email: "sophia@apexgrowth.co.uk",
    client_currency: "GBP",
    client_country: "United Kingdom",
    client_trusted: true,
    amount: "2640.00",
    currency: "GBP",
    status: "overdue",
    due_date: "2026-10-30",
    issue_date: "2026-10-08",
    tax_rate: "0.20",
    discount: "0.00",
    line_items: [
      { description: "AI Agent Prompt Engineering & System Safety", qty: 20, price: 110 }
    ],
    notes: "Payment is overdue. Automated chaser generated."
  }
];

/**
 * GET /api/invoices — List all invoices with client info
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT i.*, c.name as client_name, c.email as client_email,
             c.currency as client_currency, c.country as client_country,
             c.trusted as client_trusted
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      ORDER BY i.created_at DESC
    `);
    res.json({ invoices: result.rows });
  } catch (err) {
    console.warn('[Invoices] Database unavailable, returning demo fallback:', err.message);
    res.json({ invoices: DEMO_INVOICES, demoMode: true });
  }
});

/**
 * GET /api/invoices/dashboard — Aggregated metrics
 */
router.get('/dashboard', async (req, res) => {
  try {
    const [totals, statusCounts, recent, clients] = await Promise.all([
      db.query(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_paid,
          COALESCE(SUM(CASE WHEN status IN ('sent','overdue','pending_approval') THEN amount ELSE 0 END), 0) as total_outstanding,
          COALESCE(SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END), 0) as total_overdue,
          COUNT(*) as total_invoices
        FROM invoices
      `),
      db.query(`
        SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
        FROM invoices
        GROUP BY status
      `),
      db.query(`
        SELECT i.*, c.name as client_name
        FROM invoices i
        JOIN clients c ON i.client_id = c.id
        ORDER BY i.updated_at DESC
        LIMIT 10
      `),
      db.query('SELECT * FROM clients ORDER BY name'),
    ]);

    res.json({
      metrics: totals.rows[0],
      statusBreakdown: statusCounts.rows,
      recentInvoices: recent.rows,
      clients: clients.rows,
    });
  } catch (err) {
    console.warn('[Invoices] Dashboard database query fallback:', err.message);
    res.json({
      metrics: { total_paid: 5850, total_outstanding: 8930, total_overdue: 2640, total_invoices: 4 },
      statusBreakdown: [
        { status: 'paid', count: 1, total: 5850 },
        { status: 'sent', count: 1, total: 4730 },
        { status: 'pending_approval', count: 1, total: 4200 },
        { status: 'overdue', count: 1, total: 2640 }
      ],
      recentInvoices: DEMO_INVOICES,
      demoMode: true,
    });
  }
});

/**
 * GET /api/invoices/:id — Get single invoice with full details
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT i.*, c.name as client_name, c.email as client_email,
             c.currency as client_currency, c.country as client_country,
             c.trusted as client_trusted
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json({ invoice: result.rows[0] });
  } catch (err) {
    const found = DEMO_INVOICES.find(inv => String(inv.id) === String(req.params.id));
    if (found) {
      return res.json({ invoice: found, demoMode: true });
    }
    res.status(404).json({ error: 'Invoice not found' });
  }
});

/**
 * POST /api/invoices — Create a new invoice
 */
router.post('/', async (req, res) => {
  try {
    const {
      invoice_number, client_id, currency, due_date, issue_date,
      tax_rate, discount, line_items, notes
    } = req.body;

    // Validate required fields
    if (!client_id || !currency || !due_date || !line_items || line_items.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: client_id, currency, due_date, line_items'
      });
    }

    // Calculate total amount
    const subtotal = line_items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const taxAmount = subtotal * (tax_rate || 0);
    const amount = subtotal + taxAmount - (discount || 0);

    const idemKey = crypto.randomUUID();
    const invNumber = invoice_number || `INV-${Date.now()}`;

    const result = await db.query(`
      INSERT INTO invoices (invoice_number, client_id, amount, currency, status,
                            due_date, issue_date, tax_rate, discount, line_items,
                            notes, idempotency_key)
      VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      invNumber, client_id, amount.toFixed(2), currency,
      due_date, issue_date || new Date().toISOString().split('T')[0],
      tax_rate || 0, discount || 0, JSON.stringify(line_items),
      notes || '', idemKey,
    ]);

    const invoice = result.rows[0];

    // Insert creation event
    await db.query(`
      INSERT INTO events (invoice_id, type, payload)
      VALUES ($1, 'user.create_invoice', $2)
    `, [invoice.id, JSON.stringify({ invoice_number: invNumber, amount, currency })]);

    res.status(201).json({ invoice });
  } catch (err) {
    // If DB is offline, create in-memory demo invoice
    const { invoice_number, client_id, currency, due_date, line_items, notes } = req.body;
    const subtotal = (line_items || []).reduce((sum, item) => sum + ((item.qty || 1) * (item.price || 0)), 0);
    const demoCreated = {
      id: Date.now(),
      invoice_number: invoice_number || `INV-${Date.now().toString(36).toUpperCase()}`,
      client_id: client_id || 1,
      amount: subtotal.toFixed(2),
      currency: currency || 'USD',
      status: 'draft',
      due_date: due_date || new Date().toISOString().split('T')[0],
      line_items: line_items || [],
      notes: notes || '',
      demoMode: true
    };
    res.status(201).json({ invoice: demoCreated, demoMode: true });
  }
});

/**
 * PATCH /api/invoices/:id/status — Update invoice status
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Missing status field' });
    }

    const result = await db.query(
      "UPDATE invoices SET status = $1, updated_at = now() WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ invoice: result.rows[0] });
  } catch (err) {
    res.json({ invoice: { id: req.params.id, status: req.body.status }, demoMode: true });
  }
});

/**
 * GET /api/clients — List all clients
 */
router.get('/meta/clients', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM clients ORDER BY name');
    res.json({ clients: result.rows });
  } catch (err) {
    res.json({
      clients: [
        { id: 1, name: 'Vanguard Tech Inc.', email: 'alice@vanguardtech.io', currency: 'USD', country: 'United States', trusted: true },
        { id: 2, name: 'Nordic Design Studio Oy', email: 'marcus@nordicstudio.fi', currency: 'EUR', country: 'Finland', trusted: true }
      ],
      demoMode: true
    });
  }
});

module.exports = router;
