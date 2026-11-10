const { GoogleGenAI } = require('@google/genai');

const DEMO_MODEL = 'demo-fallback';
const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD'];

function normalizeInstruction(instruction) {
  return String(instruction || '').trim();
}

function extractJson(text) {
  if (!text || typeof text !== 'string') return '{}';
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

function toMoney(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toFixed(2);
}

function detectCurrency(input) {
  const normalized = String(input || '').toUpperCase();
  return VALID_CURRENCIES.find(currency => normalized.includes(currency)) || 'USD';
}

function detectAmount(input) {
  const match = String(input || '').match(/\$?\s?(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function getDefaultClient(clients) {
  const trusted = clients.find(client => client.trusted);
  return trusted || clients[0] || { id: 1, name: 'Demo Client', email: 'demo@example.com', currency: 'USD', trusted: true };
}

function buildDemoProposal(instruction, clients = []) {
  const safeInstruction = normalizeInstruction(instruction);
  const client = clients.find(client => new RegExp(client.name.split(' ')[0], 'i').test(safeInstruction))
    || clients.find(client => safeInstruction.toLowerCase().includes(client.email.split('@')[0].toLowerCase()))
    || getDefaultClient(clients);

  const amount = detectAmount(safeInstruction) || 850;
  const currency = detectCurrency(safeInstruction) || client.currency || 'USD';
  const description = safeInstruction.includes('reminder') ? 'Payment follow-up and collections review' :
    safeInstruction.includes('overdue') ? 'Outstanding invoice review and cash flow follow-up' :
    'Professional services rendered';

  return {
    intent: safeInstruction.toLowerCase().includes('reminder') ? 'prepare_reminder' :
      safeInstruction.toLowerCase().includes('overdue') ? 'analyze_overdue' :
      safeInstruction.toLowerCase().includes('cash flow') || safeInstruction.toLowerCase().includes('forecast') ? 'cash_flow_analysis' :
      'create_invoice',
    provider: 'demo',
    source: 'demo',
    mode: 'demo',
    note: 'Demo fallback active because Gemini is not configured or is unavailable.',
    proposed_action: {
      client_id: client.id,
      amount: toMoney(amount),
      currency,
      description,
      requires_approval: true,
      demo: true,
    },
    warnings: ['Demo model is not a live financial execution source. Human approval is required.'],
  };
}

function validateNormalizedProposal(proposal, clients = []) {
  if (!proposal || typeof proposal !== 'object') {
    return { valid: false, reason: 'Empty proposal payload from provider.' };
  }

  const clientId = proposal.client_id ?? proposal.proposed_action?.client_id ?? null;
  let client = null;

  if (clients.length) {
    client = clients.find(item => String(item.id) === String(clientId));
    if (!client) {
      return { valid: false, reason: `Client ${clientId || 'unknown'} does not exist in the trusted client list.` };
    }
  } else {
    client = getDefaultClient([]);
  }

  const amount = Number(proposal.amount ?? proposal.proposed_action?.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, reason: 'Amount is missing or invalid.' };
  }

  const currency = (proposal.currency || proposal.proposed_action?.currency || 'USD').toUpperCase();
  if (!VALID_CURRENCIES.includes(currency)) {
    return { valid: false, reason: `Unsupported currency: ${currency}.` };
  }

  return { valid: true, client, amount, currency };
}

async function generateWithGemini(instruction, clients = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    throw new Error('Gemini API key is missing.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
  });
  const clientList = clients.map(client => `- id=${client.id}, name=${client.name}, email=${client.email}, currency=${client.currency}, trusted=${client.trusted}`).join('\n');
  const prompt = `You are PayPilot's financial AI agent. Return valid JSON only, with no markdown fences. Use the client list below and do not invent values. Determine the user intent, propose one safe action, and never bypass the approval guard.

Clients:
${clientList || 'No clients available; respond with a generic safe demo action.'}

User instruction:
${instruction}

Return schema:
{
  "intent": "create_invoice|analyze_overdue|prepare_reminder|cash_flow_analysis",
  "proposed_action": {
    "client_id": 1,
    "amount": "850.00",
    "currency": "USD",
    "description": "Website development",
    "requires_approval": true
  },
  "reason": "short explanation",
  "safety_note": "human approval required"
}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const content = typeof response?.text === 'string' ? response.text : '';
  const payload = JSON.parse(extractJson(content));

  return {
    provider: 'gemini',
    source: 'gemini',
    mode: 'live',
    ...payload,
    proposed_action: {
      ...(payload.proposed_action || {}),
      client_id: Number(payload.proposed_action?.client_id || 0),
      amount: String(payload.proposed_action?.amount || '0.00'),
      currency: String(payload.proposed_action?.currency || 'USD').toUpperCase(),
      requires_approval: payload.proposed_action?.requires_approval !== false,
    },
  };
}

async function generateActionProposal({ instruction, clients = [] } = {}) {
  const safeInstruction = normalizeInstruction(instruction);
  if (!safeInstruction) {
    throw new Error('No instruction provided for AI analysis.');
  }

  const provider = process.env.AI_PROVIDER || 'gemini';

  if (provider === 'demo') {
    return buildDemoProposal(safeInstruction, clients);
  }

  try {
    const aiResult = await generateWithGemini(safeInstruction, clients);
    const validation = validateNormalizedProposal(aiResult.proposed_action || aiResult, clients);
    if (!validation.valid) {
      return {
        ...buildDemoProposal(safeInstruction, clients),
        warning: validation.reason,
      };
    }
    return aiResult;
  } catch (error) {
    const demoResult = buildDemoProposal(safeInstruction, clients);
    return {
      ...demoResult,
      provider: 'demo',
      source: 'demo',
      fallback_reason: error.message,
      warning: 'Gemini request failed; demo fallback was used for safe, clearly labeled output.',
    };
  }
}

function getProviderStatus() {
  const provider = process.env.AI_PROVIDER || 'gemini';
  const configured = Boolean(process.env.GEMINI_API_KEY);
  return {
    provider,
    configured,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    demoMode: provider === 'demo' || !configured,
    note: provider === 'demo' ? 'Demo provider active.' : configured ? 'Live Gemini provider active.' : 'Gemini is not configured; demo fallback is active.',
  };
}

module.exports = {
  buildDemoProposal,
  generateActionProposal,
  getProviderStatus,
  validateNormalizedProposal,
};
