require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────────────────

// Parse JSON for all routes EXCEPT webhooks (which needs raw body)
app.use((req, res, next) => {
  if (req.path === '/webhooks/paypal') {
    return next();
  }
  express.json({ limit: '1mb' })(req, res, next);
});

// Raw body capture for webhook signature verification
app.use('/webhooks/paypal', express.raw({ type: 'application/json' }));

// CORS headers for local dev
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── API Routes ─────────────────────────────────────────────────────────────
const invoiceRoutes = require('./routes/invoices');
const approvalRoutes = require('./routes/approvals');
const aiRoutes = require('./routes/ai');
const webhookRoutes = require('./routes/webhooks');

app.use('/api/invoices', invoiceRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/ai', aiRoutes);
app.use('/webhooks', webhookRoutes);

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const db = require('./db/pool');
  let dbOk = false;
  try {
    await db.query('SELECT 1');
    dbOk = true;
  } catch (e) { /* db not connected */ }

  let paypalOk = false;
  try {
    const paypal = require('./lib/paypal-client');
    const token = await paypal.getAccessToken();
    paypalOk = !!token;
  } catch (e) { /* paypal not configured */ }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'connected' : 'disconnected',
      paypal: paypalOk ? 'connected' : 'disconnected',
      ai: process.env.GEMINI_API_KEY ? 'configured' : 'demo_fallback',
      provider: process.env.AI_PROVIDER || 'gemini',
    }
  });
});

// ─── Dashboard & Client APIs ────────────────────────────────────────────────
app.get('/api/dashboard', async (req, res) => {
  try {
    const db = require('./db/pool');
    const result = await db.query(`
      SELECT COUNT(*)::int AS invoice_count,
             COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS collected,
             COALESCE(SUM(CASE WHEN status IN ('sent', 'overdue', 'pending_approval') THEN amount ELSE 0 END), 0) AS outstanding,
             COALESCE(SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END), 0) AS overdue
      FROM invoices
    `);
    const row = result.rows[0] || {};
    res.json({
      metrics: {
        totalInvoices: Number(row.invoice_count || 0),
        collected: Number(row.collected || 0),
        outstanding: Number(row.outstanding || 0),
        overdue: Number(row.overdue || 0),
      },
    });
  } catch (error) {
    res.json({
      metrics: {
        totalInvoices: 0,
        collected: 0,
        outstanding: 0,
        overdue: 0,
      },
      demoMode: true,
      message: 'Database unavailable; returning empty demo metrics.'
    });
  }
});

app.get('/api/clients', async (req, res) => {
  try {
    const db = require('./db/pool');
    const result = await db.query('SELECT * FROM clients ORDER BY name');
    res.json({ clients: result.rows });
  } catch (error) {
    res.json({ clients: [], demoMode: true, message: 'Database unavailable; client list unavailable.' });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const { name, email, currency, country, trusted } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }
    const db = require('./db/pool');
    const result = await db.query(
      `INSERT INTO clients (name, email, currency, country, trusted)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, email, currency || 'USD', country || 'Unknown', !!trusted]
    );
    res.status(201).json({ client: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const { name, email, currency, country, trusted } = req.body || {};
    const db = require('./db/pool');
    const result = await db.query(
      `UPDATE clients SET name = COALESCE($1, name), email = COALESCE($2, email),
                          currency = COALESCE($3, currency), country = COALESCE($4, country),
                          trusted = COALESCE($5, trusted)
       WHERE id = $6 RETURNING *`,
      [name, email, currency, country, trusted, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found.' });
    res.json({ client: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/activity', async (req, res) => {
  try {
    const db = require('./db/pool');
    const result = await db.query('SELECT * FROM events ORDER BY created_at DESC LIMIT 25');
    res.json({ events: result.rows });
  } catch (error) {
    res.json({ events: [], demoMode: true, message: 'Activity feed unavailable.' });
  }
});

app.get('/api/audit', async (req, res) => {
  try {
    const db = require('./db/pool');
    const result = await db.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 25');
    res.json({ audit: result.rows });
  } catch (error) {
    res.json({ audit: [], demoMode: true, message: 'Audit log unavailable.' });
  }
});

// ─── Static Files (Frontend) ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — serve index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Error Handler ──────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[PayPilot Error]', err.stack || err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ─── Start ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ╔══════════════════════════════════════════╗`);
    console.log(`  ║  PayPilot v2 — AI Invoice-to-Cash Agent  ║`);
    console.log(`  ╠══════════════════════════════════════════╣`);
    console.log(`  ║  Server:  http://localhost:${PORT}          ║`);
    console.log(`  ║  Mode:    ${process.env.NODE_ENV || 'development'}                  ║`);
    console.log(`  ╚══════════════════════════════════════════╝\n`);
  });
}

module.exports = app;
