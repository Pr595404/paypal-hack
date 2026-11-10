/**
 * PayPilot Automated Verification Test Suite
 * Tests server routes, demo mode fallbacks, AI provider abstraction, and static assets.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('./server');

test('PayPilot API & Demo Suite', async (t) => {
  await t.test('1. Health check returns 200 and valid status', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(res.body.services, 'Health response includes services object');
    assert.ok(res.body.services.ai, 'Health response reports AI status');
  });

  await t.test('2. Dashboard metrics endpoint returns 200 and metrics structure', async () => {
    const res = await request(app).get('/api/dashboard');
    assert.equal(res.status, 200);
    assert.ok(res.body.metrics, 'Dashboard contains metrics');
    assert.equal(typeof res.body.metrics.totalInvoices, 'number');
    assert.equal(typeof res.body.metrics.collected, 'number');
    assert.equal(typeof res.body.metrics.outstanding, 'number');
  });

  await t.test('3. Clients endpoint returns 200 with an array', async () => {
    const res = await request(app).get('/api/clients');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.clients), 'Clients is an array');
  });

  await t.test('4. Invoices endpoint returns 200 with an array', async () => {
    const res = await request(app).get('/api/invoices');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.invoices), 'Invoices is an array');
    assert.ok(res.body.invoices.length > 0, 'Invoices array contains items');
  });

  await t.test('5. Approvals endpoint returns 200 with an array', async () => {
    const res = await request(app).get('/api/approvals');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.approvals), 'Approvals is an array');
    assert.ok(res.body.approvals.length > 0, 'Approvals array contains items');
  });

  await t.test('6. AI provider status endpoint returns 200', async () => {
    const res = await request(app).get('/api/ai/status');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(res.body.provider, 'Reports provider configuration');
  });

  await t.test('7. AI command endpoint parses natural language gracefully', async () => {
    const res = await request(app)
      .post('/api/ai/command')
      .send({ instruction: 'Create an $850 invoice for Alice for website development, due in 14 days' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(res.body.proposal, 'Proposal returned');
    assert.ok(res.body.proposal.proposed_action, 'Contains proposed_action');
    assert.equal(typeof res.body.proposal.proposed_action.amount, 'string');
    assert.ok(Number(res.body.proposal.proposed_action.amount) > 0, 'Amount is a positive number');
  });

  await t.test('8. Activity and audit endpoints return 200', async () => {
    const actRes = await request(app).get('/api/activity');
    assert.equal(actRes.status, 200);
    assert.ok(Array.isArray(actRes.body.events));

    const auditRes = await request(app).get('/api/audit');
    assert.equal(auditRes.status, 200);
    assert.ok(Array.isArray(auditRes.body.audit));
  });

  await t.test('9. Root homepage serves index.html with PayPilot UI branding', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.match(res.text, /PayPilot/i);
    assert.match(res.text, /styles\.css/i);
    assert.match(res.text, /script\.js/i);
  });

  await t.test('10. Static assets (styles.css & script.js) are accessible', async () => {
    const cssRes = await request(app).get('/styles.css');
    assert.equal(cssRes.status, 200);
    assert.match(cssRes.text, /--primary/i);

    const jsRes = await request(app).get('/script.js');
    assert.equal(jsRes.status, 200);
    assert.match(jsRes.text, /PayPilot/i);
  });
});
