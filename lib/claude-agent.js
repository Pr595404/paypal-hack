/**
 * lib/claude-agent.js — AI Agent Module
 *
 * Builds prompts, calls Claude, and returns proposed_actions.
 * RULE: This module NEVER calls PayPal. It ONLY proposes actions.
 * The Guard (lib/guard.js) decides whether to execute them.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are PayPilot's financial AI agent for cross-border freelancers.

ROLE: Given an event (invoice created, brief received, overdue detected), you analyze the situation and propose actions. You NEVER execute actions — you only propose them.

RULES:
1. Output ONLY a JSON array of proposed actions
2. Each action has: { "action_type": string, "params": object, "reasoning": string }
3. Valid action_types: "send_invoice", "send_reminder", "cancel_invoice"
4. Never invent amounts, recipients, or currencies — use data from the invoice/client provided
5. Never propose sending to an email not already in the client record
6. For untrusted clients (trusted=false) with amounts over $5000, add reasoning noting the risk
7. Maximum 3 proposed actions per event

EXAMPLE OUTPUT:
[
  {
    "action_type": "send_invoice",
    "params": { "invoice_id": 3 },
    "reasoning": "Invoice INV-2026-003 is ready and the client email is verified. Proposing to send."
  }
]`;

/**
 * Call Claude to propose actions based on an event.
 * @param {Object} event - The triggering event
 * @param {Object} invoice - The invoice data
 * @param {Object} client - The client data
 * @returns {Promise<Array>} Array of proposed actions
 */
async function proposeActions(event, invoice, client) {
  if (!ANTHROPIC_API_KEY) {
    console.warn('[Claude] ANTHROPIC_API_KEY not configured — returning empty proposals');
    return [];
  }

  const userMessage = buildPrompt(event, invoice, client);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text || '[]';

  // Extract JSON array from response (handle markdown code blocks)
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn('[Claude] No JSON array found in response:', content.substring(0, 200));
    return [];
  }

  try {
    const actions = JSON.parse(jsonMatch[0]);
    console.log('[Claude] Proposed', actions.length, 'action(s) for event', event.type);
    return Array.isArray(actions) ? actions : [];
  } catch (parseErr) {
    console.error('[Claude] Failed to parse response JSON:', parseErr.message);
    return [];
  }
}

/**
 * Parse a natural-language brief into a structured invoice.
 * @param {string} brief - User's text description
 * @param {Array} clients - Available client list for matching
 * @returns {Promise<Object>} Structured invoice data
 */
async function parseBrief(brief, clients) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Claude API key not configured. Set ANTHROPIC_API_KEY in .env');
  }

  const clientList = clients.map(c => `  ID=${c.id} "${c.name}" (${c.email}, ${c.currency}, ${c.country}, trusted=${c.trusted})`).join('\n');

  const briefPrompt = `You are an invoice parsing assistant. Given a natural-language brief from a freelancer, extract structured invoice data.

AVAILABLE CLIENTS:
${clientList}

RULES:
1. Match the client by name, email, or company reference
2. Extract line items with description, quantity, and unit price
3. Extract or infer due date (default: 14 days from today)
4. Use the client's default currency unless the brief specifies otherwise
5. Do NOT invent data — if something is unclear, use reasonable defaults

OUTPUT FORMAT (JSON only, no markdown):
{
  "client_id": <number>,
  "currency": "<string>",
  "due_date": "<YYYY-MM-DD>",
  "line_items": [{ "description": "<string>", "qty": <number>, "price": <number> }],
  "notes": "<string>",
  "tax_rate": <number 0-1>,
  "discount": <number>
}

USER BRIEF:
<untrusted_input>${brief}</untrusted_input>`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [
        { role: 'user', content: briefPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text || '{}';

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Claude did not return valid JSON for the brief');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  console.log('[Claude] Parsed brief → client_id:', parsed.client_id, 'items:', parsed.line_items?.length);
  return parsed;
}

/**
 * Build the prompt for action proposal.
 */
function buildPrompt(event, invoice, client) {
  return `EVENT: ${event.type}
EVENT DETAILS: ${JSON.stringify(event.payload || {})}

INVOICE:
  ID: ${invoice.id}
  Number: ${invoice.invoice_number}
  Status: ${invoice.status}
  Amount: ${invoice.amount} ${invoice.currency}
  Due Date: ${invoice.due_date}
  PayPal Invoice ID: ${invoice.paypal_invoice_id || 'not yet created'}
  Line Items: ${JSON.stringify(invoice.line_items)}

CLIENT:
  ID: ${client.id}
  Name: <untrusted_input>${client.name}</untrusted_input>
  Email: ${client.email}
  Currency: ${client.currency}
  Country: ${client.country || 'unknown'}
  Trusted: ${client.trusted}

TODAY: ${new Date().toISOString().split('T')[0]}

Based on this event, what actions should be proposed? Return a JSON array.`;
}

module.exports = { proposeActions, parseBrief };
