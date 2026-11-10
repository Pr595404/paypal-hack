/**
 * lib/paypal-client.js — PayPal REST API v2 Integration
 *
 * Handles OAuth token management, invoice CRUD, reminders,
 * and webhook signature verification against PayPal Sandbox.
 *
 * RULE: This module is ONLY called by the Guard (lib/guard.js)
 * for approved actions, or by routes/webhooks.js for verification.
 * The AI agent NEVER calls this module directly.
 */

const BASE_URL = () => process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

// Token cache
let cachedToken = null;
let tokenExpiry = 0;

function getPayPalConfig() {
  return {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    webhookId: process.env.PAYPAL_WEBHOOK_ID,
  };
}

/**
 * Get an OAuth 2.0 access token (cached until near expiry).
 * @returns {Promise<string>} Bearer token
 */
async function getAccessToken() {
  const { clientId, clientSecret } = getPayPalConfig();

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env');
  }

  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(`${BASE_URL()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal OAuth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);

  console.log('[PayPal] OAuth token acquired, expires in', data.expires_in, 'seconds');
  return cachedToken;
}

/**
 * Make an authenticated request to PayPal.
 */
async function paypalFetch(method, path, body = null, extraHeaders = {}) {
  const token = await getAccessToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL()}${path}`, opts);

  // Some endpoints return 204 No Content
  if (res.status === 204 || res.status === 202) {
    return { status: res.status, data: null };
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error(`PayPal ${method} ${path} failed (${res.status})`);
    err.status = res.status;
    err.paypalError = data;
    throw err;
  }

  return { status: res.status, data };
}

/**
 * Generate the next invoice number from PayPal.
 * @returns {Promise<string>} e.g. "INV-0005"
 */
async function generateInvoiceNumber() {
  const { data } = await paypalFetch('POST', '/v2/invoicing/generate-next-invoice-number');
  return data.invoice_number;
}

/**
 * Create a draft invoice on PayPal.
 * @param {Object} invoiceData - { invoice_number, currency, due_date, client_email, client_name, items, notes }
 * @param {string} idempotencyKey - UUID for idempotent creation
 * @returns {Promise<Object>} PayPal invoice object with { id, status }
 */
async function createInvoice(invoiceData, idempotencyKey) {
  const { invoice_number, currency, due_date, issue_date, client_email, client_name, items, notes } = invoiceData;

  const body = {
    detail: {
      invoice_number: invoice_number,
      invoice_date: issue_date || new Date().toISOString().split('T')[0],
      currency_code: currency,
      payment_term: {
        due_date: due_date,
      },
      note: notes || '',
    },
    primary_recipients: [
      {
        billing_info: {
          email_address: client_email,
          name: parseName(client_name),
        },
      },
    ],
    items: items.map(item => ({
      name: item.description || item.name,
      quantity: String(item.qty || item.quantity || 1),
      unit_amount: {
        currency_code: currency,
        value: String(Number(item.price || item.unit_amount || 0).toFixed(2)),
      },
    })),
  };

  const { data } = await paypalFetch('POST', '/v2/invoicing/invoices', body, {
    'PayPal-Request-Id': idempotencyKey,
  });

  console.log('[PayPal] Invoice created:', data.id, 'Status:', data.status);
  return data;
}

/**
 * Send an existing draft invoice to the recipient.
 * @param {string} paypalInvoiceId - e.g. "INV2-XXXX-..."
 * @returns {Promise<void>}
 */
async function sendInvoice(paypalInvoiceId) {
  await paypalFetch('POST', `/v2/invoicing/invoices/${paypalInvoiceId}/send`, {
    send_to_recipient: true,
    send_to_invoicer: true,
  });
  console.log('[PayPal] Invoice sent:', paypalInvoiceId);
}

/**
 * Send a payment reminder for an invoice.
 * Max 2 per invoice per 24 hours.
 * @param {string} paypalInvoiceId
 * @param {string} [note]
 * @returns {Promise<void>}
 */
async function sendReminder(paypalInvoiceId, note) {
  await paypalFetch('POST', `/v2/invoicing/invoices/${paypalInvoiceId}/remind`, {
    send_to_recipient: true,
    send_to_invoicer: false,
    note: note || 'Friendly reminder regarding your pending balance.',
  });
  console.log('[PayPal] Reminder sent:', paypalInvoiceId);
}

/**
 * Cancel a sent invoice.
 * @param {string} paypalInvoiceId
 * @param {string} [reason]
 * @returns {Promise<void>}
 */
async function cancelInvoice(paypalInvoiceId, reason) {
  await paypalFetch('POST', `/v2/invoicing/invoices/${paypalInvoiceId}/cancel`, {
    send_to_recipient: true,
    send_to_invoicer: true,
    note: reason || 'This invoice has been cancelled.',
  });
  console.log('[PayPal] Invoice cancelled:', paypalInvoiceId);
}

/**
 * Get invoice details from PayPal.
 * @param {string} paypalInvoiceId
 * @returns {Promise<Object>}
 */
async function getInvoice(paypalInvoiceId) {
  const { data } = await paypalFetch('GET', `/v2/invoicing/invoices/${paypalInvoiceId}`);
  return data;
}

/**
 * Verify a webhook signature by calling PayPal's verification endpoint.
 * @param {Object} headers - Incoming request headers (lowercased keys)
 * @param {Buffer|string} rawBody - Raw request body (NOT parsed JSON)
 * @returns {Promise<boolean>} true if signature is valid
 */
async function verifyWebhookSignature(headers, rawBody) {
  const { webhookId } = getPayPalConfig();
  if (!webhookId) {
    console.warn('[PayPal] PAYPAL_WEBHOOK_ID not set — skipping signature verification');
    return false;
  }

  const webhookEvent = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf8'));

  const verifyBody = {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: webhookEvent,
  };

  const { data } = await paypalFetch('POST', '/v1/notifications/verify-webhook-signature', verifyBody);

  const isValid = data && data.verification_status === 'SUCCESS';
  console.log('[PayPal] Webhook signature verification:', isValid ? 'SUCCESS' : 'FAILURE');
  return isValid;
}

/**
 * Parse a full name into given_name + surname for PayPal.
 */
function parseName(fullName) {
  if (!fullName) return { given_name: 'Client', surname: '' };
  const parts = fullName.trim().split(/\s+/);
  return {
    given_name: parts[0],
    surname: parts.slice(1).join(' ') || '',
  };
}

module.exports = {
  getAccessToken,
  generateInvoiceNumber,
  createInvoice,
  sendInvoice,
  sendReminder,
  cancelInvoice,
  getInvoice,
  verifyWebhookSignature,
};
