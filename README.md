# PayPilot — AI Invoice-to-Cash Agent

> **"Gets you paid. Can't move money without your approval."**  
> An autonomous, safety-guarded AI financial operations agent built for cross-border freelancers, consultants, and independent agencies.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)
[![PayPal Sandbox](https://img.shields.io/badge/PayPal-Sandbox%20Ready-003087.svg)](https://developer.paypal.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20AI-Gemini%202.5-4285F4.svg)](https://aistudio.google.com/)

---

## Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Solution & Key Features](#solution--key-features)
4. [System Architecture & Safety Guard](#system-architecture--safety-guard)
5. [Tech Stack](#tech-stack)
6. [Screenshots](#screenshots)
7. [Prerequisites](#prerequisites)
8. [Installation & Setup](#installation--setup)
9. [Environment Variables](#environment-variables)
10. [Running the Application](#running-the-application)
11. [Running Tests](#running-tests)
12. [Zero-Config Demo Mode](#zero-config-demo-mode)
13. [PayPal Sandbox Integration Guide](#paypal-sandbox-integration-guide)
14. [Google Gemini Setup Guide](#google-gemini-setup-guide)
15. [PostgreSQL (Neon) Database Setup](#postgresql-neon-database-setup)
16. [API Reference](#api-reference)
17. [Security & Safety Principles](#security--safety-principles)
18. [License](#license)

---

## Overview

**PayPilot** solves the painful, manual invoice-to-cash lifecycle for international freelancers and service providers. It pairs a **natural-language AI agent** powered by Google Gemini with a **deterministic, non-LLM safety guard** that prevents unauthorized money movement. 

PayPilot allows freelancers to describe financial tasks in plain English (e.g., *"Bill Alice $1,200 for sprint 3 architecture due in 14 days"*), parses line items and currency conversions, stages proposals in an approvals inbox, enforces strict safety policies, and dispatches compliant invoices and payment reminders directly through the **PayPal Invoicing REST API v2**.

---

## Problem Statement

Cross-border freelancers face three chronic cash flow bottlenecks:
1. **Administrative Drag**: Drafting multilingual, multi-currency invoices with appropriate line items and terms takes valuable billable hours.
2. **Late Payments & Chasing Fatigue**: Following up on overdue international invoices is emotionally exhausting and inconsistent, leading to delayed cash flow.
3. **Safety Fears with Autonomous AI**: Autonomous financial agents that move money or send binding invoices without human validation risk costly hallucinations, fraud, or damaged client relationships.

---

## Solution & Key Features

PayPilot automates the invoice lifecycle while maintaining a human-in-the-loop guarantee:

- **AI Natural Language Invoicing**: Tell PayPilot who you worked for and what you delivered; the AI agent parses clients, line items, taxes, currency codes, and payment terms.
- **Deterministic Approval Guard**: AI never executes financial transactions directly. Every action is inserted into a staging ledger (`proposed_actions`) and evaluated against deterministic security policies (currency allowlists, client trust status, $5,000 limits, idempotency keys, reminder rate limits).
- **PayPal Sandbox Invoicing**: Seamlessly creates, sends, reminds, and cancels draft and active invoices through PayPal REST API v2.
- **Real-Time Webhook Reconciliation**: Listens for `INVOICING.INVOICE.PAID` and `INVOICING.INVOICE.CANCELLED` webhooks, verifies PayPal digital signatures, and deduplicates events.
- **Automated Escalation & Reminders**: Monitors overdue status and prepares polite, professional reminder templates within PayPal's rate limits (max 2 manual reminders per 24 hours).
- **Client Risk & Trust Scoring**: Evaluates repeat payment history and flags untrusted or high-value international contracts for mandatory manual review.
- **Audit Trail & Observability**: Every proposal, policy check, human approval, and PayPal API response is permanently logged in a tamper-evident audit ledger.
- **Client-Side PDF Generation**: One-click professional vector PDF invoice download directly from the browser using jsPDF.

---

## System Architecture & Safety Guard

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser Frontend                       │
│    (Vanilla JS SPA + Chart.js Visualizations + CSS Tokens)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP REST / JSON
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express API (server.js)                   │
├──────────────────────────────┬──────────────────────────────┤
│  AI Engine (Google Gemini)   │   Deterministic Guard Engine │
│  - Natural language parsing  │   - Plain code (NO LLM)      │
│  - Proposes actions only     │   - Currency allowlist check │
│  - Input sanitization        │   - Untrusted amount checks  │
│  - Never touches PayPal      │   - Idempotency validation   │
└──────────────┬───────────────┴──────────────┬───────────────┘
               │ Proposed Action              │ Approved Action Only
               ▼                              ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│   PostgreSQL / Demo Ledger   │ │  PayPal REST API v2 Client  │
│   - clients & invoices       │ │  - OAuth token lifecycle    │
│   - proposed_actions queue   │ │  - /v2/invoicing/invoices   │
│   - immutable audit_log      │ │  - /remind, /cancel, /send  │
└──────────────────────────────┘ └──────────────┬──────────────┘
                                                │
                                                ▼
                                 ┌─────────────────────────────┐
                                 │   PayPal Sandbox Network    │
                                 └─────────────────────────────┘
```

### The Non-Negotiable Guard Rules
1. **AI Never Calls PayPal Directly**: The LLM outputs structured proposals (`action_type`, `params`, `reasoning`). It has zero network access to payment APIs.
2. **Deterministic Code Guard**: Evaluates policies in plain JavaScript without model inference.
3. **Idempotency Enforcement**: Every outbound PayPal invoice creation includes a unique `PayPal-Request-Id` UUID header to prevent double billing.
4. **Input Wrapping**: Untrusted client inputs are wrapped in `<untrusted_input>` blocks to thwart prompt injection.

---

## Tech Stack

- **Backend**: Node.js (v18+), Express 4.x
- **AI Intelligence**: Google Gemini API (`@google/genai` SDK, `gemini-2.5-flash`) with fallback demo provider
- **Payment Gateway**: PayPal REST API v2 (Invoicing & Notifications)
- **Database**: PostgreSQL (`pg` pool, Neon Serverless compatible) with offline in-memory fallback
- **Frontend**: Lightweight vanilla JavaScript, custom CSS tokens design system, Chart.js, jsPDF
- **Test Framework**: Node.js Native Test Runner (`node:test`, `node:assert`), Supertest

---

## Screenshots

> *Tip for Judges and Reviewers: You can capture genuine live screenshots by running the application locally (`npm start`) and visiting `http://localhost:3000`.*

### Recommended Views to Inspect:
1. **Financial Operations Dashboard**: Live receivable metrics, monthly revenue trends, and overdue breakdown.
2. **AI Command Center**: Natural language brief box staging an invoice proposal.
3. **Guard Approvals Inbox**: Pending proposed actions awaiting manual human authorization with policy check explanations.
4. **Interactive Invoice Sheet**: Invoice detail drawer with live payment status badge and PDF export.

```
screenshots/
├── 01-dashboard.png       # Main overview with financial KPIs & Chart.js graph
├── 02-ai-brief.png        # Natural language input with staged proposal
├── 03-approvals-guard.png # Deterministic safety guard holding an action
└── 04-invoice-detail.png  # Detailed invoice view with PayPal payment status
```

---

## Prerequisites

- **Node.js**: Version 18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **npm**: Version 8.0.0 or higher
- **Web Browser**: Modern browser (Chrome, Edge, Firefox, Safari)

---

## Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Pr595404/paypal-hack.git
   cd paypal-hack
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   ```bash
   # On macOS / Linux:
   cp .env.example .env

   # On Windows PowerShell:
   copy .env.example .env
   ```

---

## Environment Variables

Edit your local `.env` file. A complete template is provided in [`.env.example`](.env.example):

| Variable | Description | Default / Example | Required for Demo? |
| :--- | :--- | :--- | :--- |
| `PORT` | Local web server port | `3000` | No (Defaults to 3000) |
| `NODE_ENV` | Environment mode | `development` | No |
| `AI_PROVIDER` | AI backend engine (`gemini` or `demo`) | `gemini` | No |
| `GEMINI_API_KEY` | Google AI Studio Gemini API Key | `AIzaSy...` | No (Activates demo AI if empty) |
| `GEMINI_MODEL` | Gemini Model identifier | `gemini-2.5-flash` | No |
| `PAYPAL_CLIENT_ID` | PayPal Sandbox App Client ID | `YOUR_CLIENT_ID` | No (Activates demo gateway if empty) |
| `PAYPAL_CLIENT_SECRET` | PayPal Sandbox App Secret | `YOUR_SECRET` | No (Activates demo gateway if empty) |
| `PAYPAL_BASE_URL` | PayPal API Endpoint | `https://api-m.sandbox.paypal.com` | No |
| `PAYPAL_WEBHOOK_ID` | Webhook verification identifier | `optional_id` | No |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` | No (Uses in-memory store if empty) |

---

## Running the Application

### Development Mode (with file watching):
```bash
npm run dev
```

### Production / Standard Mode:
```bash
npm start
```

Once started, open your web browser and navigate to:
```text
http://localhost:3000/
```

---

## Running Tests

PayPilot includes an end-to-end automated test suite covering API routes, static asset serving, demo mode fallbacks, and natural language command parsing.

Run the test suite using Node's native test runner:
```bash
npm test
```

### Expected Output:
```text
TAP version 13
# Subtest: PayPilot API & Demo Suite
    ok 1 - Health check returns 200 and valid status
    ok 2 - Dashboard metrics endpoint returns 200 and metrics structure
    ok 3 - Clients endpoint returns 200 with an array
    ok 4 - Invoices endpoint returns 200 with an array
    ok 5 - Approvals endpoint returns 200 with an array
    ok 6 - AI provider status endpoint returns 200
    ok 7 - AI command endpoint parses natural language gracefully
    ok 8 - Activity and audit endpoints return 200
    ok 9 - Root homepage serves index.html with PayPilot UI branding
    ok 10 - Static assets (styles.css & script.js) are accessible
ok 1 - PayPilot API & Demo Suite
# tests 11
# pass 11
# fail 0
```

---

## Zero-Config Demo Mode

**Judges and evaluators can test PayPilot immediately without signing up for third-party API accounts!**

- When `DATABASE_URL` is omitted, PayPilot automatically initializes an in-memory/localStorage seed dataset with realistic multi-currency clients, invoices, and audit histories.
- When `GEMINI_API_KEY` is omitted, PayPilot's deterministic Demo AI provider processes invoice commands, calculates taxes, and structures proposals safely.
- When `PAYPAL_CLIENT_ID` is omitted, invoice sending and reminder operations demonstrate realistic sandbox states without blocking the user interface.

---

## PayPal Sandbox Integration Guide

To connect live PayPal Sandbox features:

1. Log in to the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).
2. Navigate to **Apps & Credentials** and select the **Sandbox** tab.
3. Click **Create App**, select **Merchant** type, and name your app (e.g., `PayPilot-Test`).
4. Copy the **Client ID** and **Secret** into your `.env` file:
   ```env
   PAYPAL_CLIENT_ID=your_sandbox_client_id_here
   PAYPAL_CLIENT_SECRET=your_sandbox_client_secret_here
   PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
   ```
5. *(Optional)* To test real-time payment notifications, configure a Webhook pointing to your deployed domain or tunneling URL (e.g., `https://your-domain.com/webhooks/paypal`) subscribing to:
   - `INVOICING.INVOICE.PAID`
   - `INVOICING.INVOICE.SENT`
   - `INVOICING.INVOICE.CANCELLED`

---

## Google Gemini Setup Guide

To enable live Google Gemini natural-language processing:

1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account and click **Get API key**.
3. Create a free key and add it to your `.env`:
   ```env
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ```
4. Restart your server. The `/api/health` endpoint will confirm: `"ai": "configured"`.

---

## PostgreSQL (Neon) Database Setup

To enable cloud persistence across server restarts:

1. Create a free serverless PostgreSQL database at [Neon](https://neon.tech/).
2. Copy your connection string into `.env`:
   ```env
   DATABASE_URL=postgresql://user:password@ep-xyz.region.neon.tech/paypilot?sslmode=require
   ```
3. Initialize the schema:
   ```bash
   npm run db:init
   ```
4. Seed demo clients and invoices:
   ```bash
   npm run db:seed
   ```

---

## API Reference

### Core Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health, connectivity, and active AI mode |
| `GET` | `/api/dashboard` | Aggregated receivables, collection totals, and status breakdown |
| `GET` | `/api/clients` | List of clients with currency, country, and trust status |
| `POST` | `/api/clients` | Add a new client record |
| `GET` | `/api/invoices` | List invoices with line items and payment statuses |
| `POST` | `/api/invoices` | Create a draft invoice |
| `GET` | `/api/invoices/:id` | Get full details for an individual invoice |
| `PATCH` | `/api/invoices/:id/status`| Update status (`draft`, `sent`, `paid`, `cancelled`) |
| `GET` | `/api/approvals` | List staged actions awaiting manual human approval |
| `POST` | `/api/approvals/:id/approve` | Authorize and execute a proposed action via the Guard |
| `POST` | `/api/approvals/:id/reject` | Reject a proposed action with reason |
| `GET` | `/api/ai/status` | Current AI provider, active model, and configuration |
| `POST` | `/api/ai/command` | Parse natural language brief into structured financial proposal |
| `GET` | `/api/activity` | Recent financial timeline and system events |
| `GET` | `/api/audit` | Permanent tamper-evident guard decision log |
| `POST` | `/webhooks/paypal` | PayPal webhook endpoint with signature verification |

---

## Security & Safety Principles

- **No Secrets in Version Control**: `.env` and credential files are strictly ignored via [`.gitignore`](.gitignore).
- **Prompt Injection Defense**: Client names and user briefs are sanitized and enclosed in isolated XML data boundaries (`<untrusted_input>`) before processing.
- **Model Output Verification**: The AI output schema is strictly validated by deterministic code before any action can enter the pending approval queue.
- **Human In The Loop**: Actions involving live fund requests, reminder emails, or status voiding require human approval by default.
- **Signature Verification**: Live webhooks are verified through PayPal's cryptographic signature verification API before event ledger entry.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```text
Copyright (c) 2026 PayPilot Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software...
```
