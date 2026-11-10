/**
 * routes/ai.js — AI instruction processing & provider abstraction
 */
const express = require('express');
const router = express.Router();
const db = require('../db/pool');
const { generateActionProposal, getProviderStatus } = require('../lib/ai-provider');

router.get('/status', async (req, res) => {
  try {
    res.json({ status: 'ok', provider: getProviderStatus() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function handleInstructionRequest(req, res) {
  try {
    const instruction = String(req.body?.instruction || req.body?.brief || '').trim();
    if (!instruction) {
      return res.status(400).json({ error: 'Missing instruction or brief text.' });
    }

    let clients = [];
    try {
      const result = await db.query('SELECT * FROM clients ORDER BY name');
      clients = result.rows;
    } catch (dbError) {
      console.warn('[AI] No database connection; using empty demo client list.', dbError.message);
    }

    const proposal = await generateActionProposal({ instruction, clients });

    return res.json({
      status: 'ok',
      instruction,
      provider: proposal.provider || getProviderStatus(),
      proposal,
      validation: proposal.proposed_action ? {
        valid: !!proposal.proposed_action && Number(proposal.proposed_action.amount || 0) > 0,
      } : { valid: false },
    });
  } catch (error) {
    console.error('[AI] Command error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

router.post('/command', handleInstructionRequest);

router.post('/brief', handleInstructionRequest);

router.post('/analyze', async (req, res) => {
  try {
    const instruction = req.body?.instruction || `Analyze invoice ${req.body?.invoice_id || 'current'}`;
    let clients = [];
    try {
      const result = await db.query('SELECT * FROM clients ORDER BY name');
      clients = result.rows;
    } catch (dbError) {
      console.warn('[AI] No database connection during analyze fallback.', dbError.message);
    }

    const proposal = await generateActionProposal({ instruction, clients });
    res.json({
      status: 'ok',
      proposals: [proposal],
      provider: getProviderStatus(),
    });
  } catch (error) {
    console.error('[AI] Analyze legacy error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
