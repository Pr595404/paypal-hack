# PayPilot

PayPilot is a trustworthy AI-powered financial operations prototype for freelancers and small businesses. It combines a human-readable dashboard, a deterministic approval guard, an AI planning layer, and PayPal sandbox readiness in one simple Express app.

## Overview

This project keeps the existing front-end UI intact, adds a secure Node/Express backend, and supports a Gemini-first AI workflow with a clearly labelled demo fallback when credentials are unavailable.

## Product goals

- Invoice creation and review
- Overdue and reminder workflows
- AI instruction parsing with guard enforcement
- Human approvals for consequential actions
- PayPal sandbox integration paths
- Audit trail and verification

## Quick start

1. Install dependencies
   ```bash
   npm install
   ```

2. Copy environment values
   ```bash
   copy .env.example .env
   ```

3. Fill in your local credentials
   - PayPal Sandbox client ID and secret
   - Gemini API key if available
   - PostgreSQL connection string for Neon (optional for local demo mode)

4. Start the app
   ```bash
   npm start
   ```

5. Open the app
   ```text
   http://localhost:3000/
   ```

## Environment configuration

Use the variables below in your local `.env` file. Do not commit `.env` to GitHub.

```env
PAYPAL_CLIENT_ID=YOUR_SANDBOX_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_NEW_ROTATED_SANDBOX_SECRET
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_WEBHOOK_ID=

AI_PROVIDER=gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash

DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/paypilot?sslmode=require

PORT=3000
NODE_ENV=development
APP_BASE_URL=http://localhost:3000
SESSION_SECRET=YOUR_RANDOM_SESSION_SECRET
```

## Gemini setup guide

1. Open the Google AI Studio page: https://aistudio.google.com/
2. Sign in with your Google account.
3. Create an API key under the API section.
4. Confirm model availability for your region and current quota.
5. Add the key to `.env` as `GEMINI_API_KEY`.
6. Optionally set `GEMINI_MODEL` to the model currently available to your account.

If Gemini is unavailable or quota is exhausted, the app automatically falls back to a clearly labeled demo AI provider. Demo responses are never presented as live Gemini output.

## PayPal Sandbox setup guide

1. Go to the PayPal Developer Dashboard.
2. Create a sandbox business account.
3. Generate or rotate a sandbox client secret and store it in `.env`.
4. Leave `PAYPAL_BASE_URL` as `https://api-m.sandbox.paypal.com`.
5. Keep webhook verification disabled or configured with the webhook ID when you are ready to test real webhook events.
6. Never switch to live mode unless you explicitly authorize it.

## Database setup

This project supports PostgreSQL via Neon or any compatible PostgreSQL instance.

To initialize the schema:
```bash
npm run db:init
```

To seed sample records:
```bash
npm run db:seed
```

## API endpoints

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/clients`
- `POST /api/clients`
- `PUT /api/clients/:id`
- `GET /api/invoices`
- `GET /api/invoices/:id`
- `POST /api/invoices`
- `PUT /api/invoices/:id`
- `POST /api/invoices/:id/send`
- `POST /api/invoices/:id/remind`
- `POST /api/invoices/:id/cancel`
- `GET /api/approvals`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`
- `POST /api/ai/command`
- `GET /api/ai/status`
- `GET /api/activity`
- `GET /api/audit`
- `POST /api/webhooks/paypal`

## Demo script

A 4-minute demo flow:

1. Explain the freelancer invoice problem and collection pain.
2. Enter a natural-language instruction such as: `Create an $850 invoice for Alice for website development, due in 14 days.`
3. Show the structured AI proposal and the guard explanation.
4. Approve the action and create or send the invoice.
5. Highlight the audit trail and the approval requirement.
6. Demonstrate a dangerous or invalid action being blocked or escalated.

## Safety principles

- Gemini does not call PayPal directly.
- Gemini never executes SQL.
- The guard is deterministic and code-based.
- High-risk or invalid actions are escalated or rejected.
- Demo output is clearly labelled and never mixed with live financial actions.

## Testing

Run the verification suite:
```bash
npm test
```

## Notes

- The existing front-end remains in place and has been hardened against blank-state route initialization.
- Missing API credentials are treated as graceful fallback mode rather than catastrophic failures.
- The app is designed to remain usable in demo mode without a paid AI or live payment configuration.
