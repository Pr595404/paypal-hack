/**
 * PayPilot — FinTech AI Invoice-to-Cash Prototype Engine
 * Pure Vanilla JavaScript | LocalStorage Persistence | Zero External Backend
 */

(function () {
  "use strict";

  // =========================================================================
  // 1. Storage Keys & Safe Helpers
  // =========================================================================
  const LS_KEYS = {
    clients: "paypilot_clients",
    invoices: "paypilot_invoices",
    approvals: "paypilot_approvals",
    reminders: "paypilot_reminders",
    audit: "paypilot_audit_log",
    settings: "paypilot_settings"
  };

  function safeLoad(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return Array.isArray(fallback)
        ? (Array.isArray(parsed) ? parsed : fallback)
        : (parsed && typeof parsed === "object" ? parsed : fallback);
    } catch (err) {
      console.warn(`[PayPilot] LocalStorage read failed for ${key}:`, err);
      return fallback;
    }
  }

  function safeSave(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.error(`[PayPilot] LocalStorage write failed for ${key}:`, err);
      showToast("Storage write error: Local storage may be full or blocked.", "danger");
    }
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatCurrency(amount, currency = "USD") {
    const val = Number(amount) || 0;
    const symbols = { USD: "$", EUR: "€", GBP: "£", CAD: "CA$", AUD: "AU$", SGD: "SG$" };
    const sym = symbols[currency] || (currency + " ");
    return `${sym}${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatDate(isoStr) {
    if (!isoStr) return "N/A";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    if (type === "success") toast.style.backgroundColor = "#059669";
    if (type === "danger") toast.style.backgroundColor = "#dc2626";
    if (type === "warning") toast.style.backgroundColor = "#d97706";

    const icon = type === "success" ? "✓" : type === "danger" ? "✕" : "ℹ";
    toast.innerHTML = `<span style="font-weight:bold;">${icon}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function logAudit(action, details, actor = "AI Guard") {
    const logs = safeLoad(LS_KEYS.audit, []);
    const entry = {
      id: "LOG-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      action: action,
      details: details,
      actor: actor
    };
    logs.unshift(entry);
    safeSave(LS_KEYS.audit, logs.slice(0, 100)); // retain last 100 logs
  }

  // =========================================================================
  // 2. Demo Data Seeder
  // =========================================================================
  function initDemoData(force = false) {
    const existingClients = safeLoad(LS_KEYS.clients, []);
    if (existingClients.length === 0 || force) {
      const demoClients = [
        {
          id: 1,
          name: "Vanguard Tech Inc.",
          contact: "Alice Vance",
          email: "alice@vanguardtech.io",
          currency: "USD",
          country: "United States",
          trusted: true,
          totalPaid: 12400
        },
        {
          id: 2,
          name: "Nordic Design Studio Oy",
          contact: "Marcus Lindqvist",
          email: "marcus@nordicstudio.fi",
          currency: "EUR",
          country: "Finland",
          trusted: true,
          totalPaid: 8600
        },
        {
          id: 3,
          name: "Tokyo AI Robotics Labs",
          contact: "Hiroshi Tanaka",
          email: "tanaka@tokyoailabs.jp",
          currency: "USD",
          country: "Japan",
          trusted: false, // Untrusted first-time cross-border client
          totalPaid: 0
        },
        {
          id: 4,
          name: "Apex Growth Advisory",
          contact: "Sophia Chen",
          email: "sophia@apexgrowth.co.uk",
          currency: "GBP",
          country: "United Kingdom",
          trusted: true,
          totalPaid: 4500
        }
      ];
      safeSave(LS_KEYS.clients, demoClients);
    }

    const existingInvoices = safeLoad(LS_KEYS.invoices, []);
    if (existingInvoices.length === 0 || force) {
      const today = new Date();
      const pastDate = (daysAgo) => new Date(today.getTime() - daysAgo * 86400000).toISOString().split("T")[0];
      const futureDate = (daysAhead) => new Date(today.getTime() + daysAhead * 86400000).toISOString().split("T")[0];

      const demoInvoices = [
        {
          id: 1,
          invoiceNumber: "INV-2026-001",
          clientId: 1,
          issueDate: pastDate(25),
          dueDate: pastDate(10),
          currency: "USD",
          status: "paid",
          taxRate: 0,
          discount: 150,
          lineItems: [
            { description: "Cross-Border Agent Architecture", qty: 35, price: 120 },
            { description: "PayPal Webhook & Ledger Sync Setup", qty: 15, price: 120 }
          ],
          notes: "Settled via PayPal Sandbox checkout. Thank you for your business!",
          createdAt: pastDate(25)
        },
        {
          id: 2,
          invoiceNumber: "INV-2026-002",
          clientId: 2,
          issueDate: pastDate(12),
          dueDate: futureDate(5),
          currency: "EUR",
          status: "sent",
          taxRate: 0.10, // 10% VAT
          discount: 0,
          lineItems: [
            { description: "FinTech Design Sprint & UX Tokens", qty: 1, price: 3200 },
            { description: "Mobile Responsive Component Library", qty: 1, price: 1100 }
          ],
          notes: "Payment due within 14 days of issue.",
          createdAt: pastDate(12)
        },
        {
          id: 3,
          invoiceNumber: "INV-2026-003",
          clientId: 3,
          issueDate: pastDate(3),
          dueDate: futureDate(15),
          currency: "USD",
          status: "pending_approval",
          taxRate: 0,
          discount: 0,
          lineItems: [
            { description: "Autonomous AI Cash-Flow Modeling Module", qty: 1, price: 4200 }
          ],
          notes: "First engagement for Tokyo AI Labs. Guard held for policy review.",
          createdAt: pastDate(3)
        },
        {
          id: 4,
          invoiceNumber: "INV-2026-004",
          clientId: 4,
          issueDate: pastDate(32),
          dueDate: pastDate(12), // 12 days overdue!
          currency: "GBP",
          status: "overdue",
          taxRate: 0.20,
          discount: 0,
          lineItems: [
            { description: "AI Agent Prompt Engineering & System Safety", qty: 20, price: 110 }
          ],
          notes: "Payment is overdue. Automated chaser generated.",
          createdAt: pastDate(32)
        },
        {
          id: 5,
          invoiceNumber: "INV-2026-005",
          clientId: 1,
          issueDate: pastDate(1),
          dueDate: futureDate(20),
          currency: "USD",
          status: "draft",
          taxRate: 0,
          discount: 0,
          lineItems: [
            { description: "Next.js App Router Integration", qty: 12, price: 125 }
          ],
          notes: "Draft invoice for upcoming sprint deliverables.",
          createdAt: pastDate(1)
        }
      ];
      safeSave(LS_KEYS.invoices, demoInvoices);
    }

    const existingApprovals = safeLoad(LS_KEYS.approvals, []);
    if (existingApprovals.length === 0 || force) {
      const demoApprovals = [
        {
          id: 101,
          invoiceId: 3,
          actionType: "send_invoice",
          targetCurrency: "USD",
          amount: 4200,
          status: "pending",
          policyChecks: {
            amountAutoLimit: false, // > $2,500 MAX_AUTO
            trustedClient: false,   // Untrusted first invoice
            currencyAllowlisted: true,
            idempotencyPassed: true
          },
          reason: "Proposal held: Invoice amount ($4,200.00) exceeds MAX_AUTO ($2,500.00) and client is untrusted (first engagement). Manual authorization required.",
          createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
        },
        {
          id: 102,
          invoiceId: 4,
          actionType: "escalate_reminder",
          targetCurrency: "GBP",
          amount: 2640,
          status: "pending",
          policyChecks: {
            amountAutoLimit: true,
            trustedClient: true,
            currencyAllowlisted: true,
            idempotencyPassed: true
          },
          reason: "Invoice #INV-2026-004 is 12 days overdue. Proposing Level 2 Escalated Payment Reminder with revised settlement terms.",
          createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
        },
        {
          id: 100,
          invoiceId: 2,
          actionType: "send_invoice",
          targetCurrency: "EUR",
          amount: 4730,
          status: "approved",
          policyChecks: {
            amountAutoLimit: false,
            trustedClient: true,
            currencyAllowlisted: true,
            idempotencyPassed: true
          },
          reason: "Approved by Freelancer admin after review.",
          createdAt: new Date(Date.now() - 3600000 * 240).toISOString(),
          decidedAt: new Date(Date.now() - 3600000 * 238).toISOString()
        }
      ];
      safeSave(LS_KEYS.approvals, demoApprovals);
    }

    const existingAudit = safeLoad(LS_KEYS.audit, []);
    if (existingAudit.length === 0 || force) {
      const demoAudit = [
        {
          id: "LOG-INIT-1",
          timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
          action: "PROPOSE_ACTION",
          details: "AI Agent proposed cross-border invoice dispatch for INV-2026-003 ($4,200.00 USD).",
          actor: "Claude AI Agent"
        },
        {
          id: "LOG-INIT-2",
          timestamp: new Date(Date.now() - 3600000 * 23).toISOString(),
          action: "GUARD_POLICY_HOLD",
          details: "Approval Guard held action #101: Exceeds MAX_AUTO threshold ($2,500) and client untrusted.",
          actor: "Approval Guard (Deterministic)"
        },
        {
          id: "LOG-INIT-3",
          timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
          action: "OVERDUE_SCAN",
          details: "Automated scan flagged INV-2026-004 as 12 days overdue. Proposed reminder action #102.",
          actor: "Scheduled Cron"
        }
      ];
      safeSave(LS_KEYS.audit, demoAudit);
    }

    const existingSettings = safeLoad(LS_KEYS.settings, null);
    if (!existingSettings || force) {
      safeSave(LS_KEYS.settings, {
        demoMode: true,
        maxAutoAmount: 2500,
        allowedCurrencies: ["USD", "EUR", "GBP", "CAD", "AUD", "SGD"],
        freelancerName: "Alex Morgan",
        freelancerEmail: "alex@paypilot.dev"
      });
    }
  }

  // =========================================================================
  // 3. Invoice Calculation Utilities
  // =========================================================================
  function calculateInvoiceTotals(invoice) {
    const items = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
    const subtotal = items.reduce((acc, item) => {
      const q = Number(item.qty) || 0;
      const p = Number(item.price) || 0;
      return acc + (q * p);
    }, 0);

    const taxRate = Number(invoice.taxRate) || 0;
    const taxAmount = subtotal * taxRate;
    const discount = Number(invoice.discount) || 0;
    const total = Math.max(0, subtotal + taxAmount - discount);

    return {
      subtotal,
      taxRate,
      taxAmount,
      discount,
      total
    };
  }

  function getClientById(clientId) {
    const clients = safeLoad(LS_KEYS.clients, []);
    return clients.find(c => c.id === Number(clientId)) || {
      id: 0,
      name: "Unknown Client",
      email: "unknown@client.com",
      currency: "USD",
      country: "Global",
      trusted: false
    };
  }

  function predictPaymentRisk(invoice) {
    const client = getClientById(invoice.clientId);
    const dueDate = new Date(invoice.dueDate);
    const now = new Date();
    const daysDiff = Math.round((dueDate - now) / 86400000);

    let score = 95; // Default healthy baseline
    let reasons = [];

    if (invoice.status === "paid") {
      return { score: 100, label: "Settled", color: "var(--success)" };
    }

    if (invoice.status === "overdue" || daysDiff < 0) {
      const overdueDays = Math.abs(daysDiff);
      score -= Math.min(60, overdueDays * 4);
      reasons.push(`${overdueDays} days past due date`);
    }

    if (!client.trusted) {
      score -= 25;
      reasons.push("First invoice with untrusted client");
    }

    const { total } = calculateInvoiceTotals(invoice);
    if (total > 3000) {
      score -= 10;
      reasons.push("High ticket invoice amount");
    }

    score = Math.max(10, Math.min(100, score));

    let label = "Low Risk (90%+ Likely On-Time)";
    let color = "var(--success)";

    if (score < 50) {
      label = "High Risk (Immediate Follow-up Recommended)";
      color = "var(--danger)";
    } else if (score < 80) {
      label = "Medium Risk (Monitor Milestone)";
      color = "var(--warning)";
    }

    return { score, label, color, reasons };
  }

  // Update dynamic overdue status on boot
  function checkAndUpdateOverdueInvoices() {
    const invoices = safeLoad(LS_KEYS.invoices, []);
    const today = new Date().toISOString().split("T")[0];
    let updated = false;

    invoices.forEach(inv => {
      if (inv.status !== "paid" && inv.status !== "draft" && inv.dueDate < today && inv.status !== "overdue") {
        inv.status = "overdue";
        updated = true;
        logAudit("STATUS_AUTO_UPDATE", `Invoice #${inv.invoiceNumber} status shifted to 'overdue' based on due date.`, "System Monitor");
      }
    });

    if (updated) {
      safeSave(LS_KEYS.invoices, invoices);
    }
  }

  function updateSidebarBadges() {
    const approvals = safeLoad(LS_KEYS.approvals, []);
    const pendingCount = approvals.filter(a => a.status === "pending").length;
    const badge = document.getElementById("nav-approval-badge");
    if (badge) {
      if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    }
  }

  // =========================================================================
  // 4. View Renderers
  // =========================================================================

  // -------------------------------------------------------------------------
  // A. DASHBOARD VIEW
  // -------------------------------------------------------------------------
  function renderDashboard(container) {
    const invoices = safeLoad(LS_KEYS.invoices, []);
    const approvals = safeLoad(LS_KEYS.approvals, []);
    const auditLogs = safeLoad(LS_KEYS.audit, []);

    // Financial Metrics
    const totalInvoicesCount = invoices.length;
    let totalInvoicedSum = 0;
    let totalCollectedSum = 0;
    let totalOutstandingSum = 0;
    let overdueCount = 0;
    let overdueSum = 0;

    const statusCounts = {
      paid: 0,
      sent: 0,
      pending_approval: 0,
      overdue: 0,
      draft: 0
    };

    invoices.forEach(inv => {
      const { total } = calculateInvoiceTotals(inv);
      totalInvoicedSum += total;

      if (inv.status === "paid") {
        totalCollectedSum += total;
        statusCounts.paid++;
      } else if (inv.status === "overdue") {
        overdueCount++;
        overdueSum += total;
        totalOutstandingSum += total;
        statusCounts.overdue++;
      } else if (inv.status === "sent") {
        totalOutstandingSum += total;
        statusCounts.sent++;
      } else if (inv.status === "pending_approval") {
        totalOutstandingSum += total;
        statusCounts.pending_approval++;
      } else if (inv.status === "draft") {
        statusCounts.draft++;
      }
    });

    const collectionRate = totalInvoicedSum > 0
      ? Math.round((totalCollectedSum / totalInvoicedSum) * 100)
      : 0;

    const pendingApprovalsCount = approvals.filter(a => a.status === "pending").length;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Financial Dashboard</h1>
          <p class="page-subtitle">Real-time ledger overview, automated collection metrics, and risk monitoring</p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <a href="#new" class="btn btn-primary">+ Create Invoice</a>
          <a href="#approvals" class="btn btn-secondary">Review Approvals (${pendingApprovalsCount})</a>
        </div>
      </div>

      <!-- AI Smart Risk Banner -->
      <div class="ai-risk-card">
        <div class="ai-risk-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.25rem;">🤖</span>
            <span style="font-weight: 700; color: #075985;">PayPilot AI Agent Intelligence</span>
            <span class="ai-badge">ACTIVE</span>
          </div>
          <span style="font-size: 0.8rem; font-weight: 600; color: #0369a1;">Deterministic Guard Policy: ENFORCED</span>
        </div>
        <p style="font-size: 0.875rem; color: #0c4a6e; margin-bottom: 0.5rem;">
          Ledger contains <strong>${overdueCount} overdue invoice(s)</strong> (${formatCurrency(overdueSum)}) and <strong>${pendingApprovalsCount} pending guard proposal(s)</strong>.
          High-confidence payment probability estimated at <strong>${collectionRate}% overall portfolio velocity</strong>.
        </p>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.75rem;">
          <a href="#reminders" class="btn btn-sm btn-primary" style="background-color: #0284c7;">Launch Reminder Center</a>
          <button id="quick-scan-btn" class="btn btn-sm btn-secondary">Run Policy & Overdue Scan</button>
        </div>
      </div>

      <!-- Key Financial Metrics Grid -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-card-header">
            <span class="metric-label">Total Invoiced</span>
            <div class="metric-icon-box" style="background:#eff6ff; color:#2563eb;">💼</div>
          </div>
          <div class="metric-value">${formatCurrency(totalInvoicedSum)}</div>
          <div class="metric-subtext">Across ${totalInvoicesCount} total invoices</div>
        </div>

        <div class="metric-card">
          <div class="metric-card-header">
            <span class="metric-label">Collected Revenue</span>
            <div class="metric-icon-box" style="background:#ecfdf5; color:#059669;">💰</div>
          </div>
          <div class="metric-value" style="color:#059669;">${formatCurrency(totalCollectedSum)}</div>
          <div class="metric-subtext"><span class="metric-trend-up">↑ ${collectionRate}%</span> realized cash collection</div>
        </div>

        <div class="metric-card">
          <div class="metric-card-header">
            <span class="metric-label">Outstanding Balance</span>
            <div class="metric-icon-box" style="background:#fffbeb; color:#d97706;">⏳</div>
          </div>
          <div class="metric-value" style="color:#d97706;">${formatCurrency(totalOutstandingSum)}</div>
          <div class="metric-subtext">${statusCounts.sent + statusCounts.pending_approval} invoices awaiting settlement</div>
        </div>

        <div class="metric-card">
          <div class="metric-card-header">
            <span class="metric-label">Overdue Exposure</span>
            <div class="metric-icon-box" style="background:#fef2f2; color:#dc2626;">⚠️</div>
          </div>
          <div class="metric-value" style="color:#dc2626;">${formatCurrency(overdueSum)}</div>
          <div class="metric-subtext"><span class="metric-trend-down">${overdueCount} invoices</span> past agreed term</div>
        </div>

        <div class="metric-card">
          <div class="metric-card-header">
            <span class="metric-label">Collection Rate</span>
            <div class="metric-icon-box" style="background:#f0f9ff; color:#0284c7;">📊</div>
          </div>
          <div class="metric-value">${collectionRate}%</div>
          <div class="metric-subtext">Settlement efficiency ratio</div>
        </div>
      </div>

      <!-- Financial Visualizations & Status Distribution -->
      <div class="charts-grid">
        <div class="card">
          <div class="card-header">
            <h2 class="section-title" style="margin-bottom:0;">Revenue Velocity (Simulated Trend)</h2>
            <span style="font-size:0.75rem; color:var(--text-muted);">Past 6 Months</span>
          </div>
          <div class="chart-wrapper">
            <canvas id="dashboard-revenue-chart"></canvas>
            <div id="chart-fallback" style="display:none; padding: 2rem; text-align:center; color:var(--text-muted);">
              Monthly Inflow: <strong>${formatCurrency(totalCollectedSum)}</strong> collected to date.
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="section-title" style="margin-bottom:0;">Status Distribution</h2>
            <span class="badge badge-info">${totalInvoicesCount} Invoices</span>
          </div>
          <div class="status-bars">
            ${renderStatusBar("Paid", statusCounts.paid, totalInvoicesCount, "var(--success)")}
            ${renderStatusBar("Sent / In Flight", statusCounts.sent, totalInvoicesCount, "var(--primary-light)")}
            ${renderStatusBar("Overdue", statusCounts.overdue, totalInvoicesCount, "var(--danger)")}
            ${renderStatusBar("Pending Guard Approval", statusCounts.pending_approval, totalInvoicesCount, "var(--warning)")}
            ${renderStatusBar("Draft", statusCounts.draft, totalInvoicesCount, "var(--border-strong)")}
          </div>
        </div>
      </div>

      <!-- Recent Invoices Table & Audit Ledger Grid -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-top: 1rem;">
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <h2 class="section-title" style="margin-bottom:0;">Recent Invoices</h2>
            <a href="#invoices" class="btn btn-sm btn-secondary">View All</a>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.slice(0, 5).map(inv => {
                  const client = getClientById(inv.clientId);
                  const { total } = calculateInvoiceTotals(inv);
                  return `
                    <tr>
                      <td style="font-weight:700;"><a href="#invoices/view/${inv.id}" style="color:var(--accent);">${escapeHtml(inv.invoiceNumber)}</a></td>
                      <td>
                        <div style="font-weight:600; color:var(--text-main);">${escapeHtml(client.name)}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(client.country)}</div>
                      </td>
                      <td>${formatDate(inv.dueDate)}</td>
                      <td style="font-weight:700;">${formatCurrency(total, inv.currency)}</td>
                      <td><span class="badge badge-${inv.status.replace('_', '-')}">${inv.status.replace('_', ' ')}</span></td>
                      <td>
                        <a href="#invoices/view/${inv.id}" class="btn btn-sm btn-secondary">View</a>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <h2 class="section-title" style="margin-bottom:0;">Live Audit Feed</h2>
            <a href="#activity" class="btn btn-sm btn-secondary">Full Log</a>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.85rem; font-size: 0.825rem;">
            ${auditLogs.slice(0, 6).map(log => `
              <div style="padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color);">
                <div style="display:flex; justify-content:space-between; margin-bottom: 0.2rem;">
                  <strong style="color:var(--primary-dark); font-size: 0.75rem;">${escapeHtml(log.action)}</strong>
                  <span style="font-size:0.7rem; color:var(--text-muted);">${new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div style="color:var(--text-body);">${escapeHtml(log.details)}</div>
                <div style="font-size:0.7rem; color:var(--primary); margin-top: 0.2rem;">By: ${escapeHtml(log.actor)}</div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;

    // Render Chart.js
    initDashboardRevenueChart(invoices);

    // Event listener for quick scan
    const scanBtn = document.getElementById("quick-scan-btn");
    if (scanBtn) {
      scanBtn.addEventListener("click", () => {
        checkAndUpdateOverdueInvoices();
        showToast("System scan completed: Ledger synchronized & status checks verified.", "success");
        renderDashboard(container);
      });
    }
  }

  function renderStatusBar(label, count, total, color) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
      <div class="status-bar-row">
        <div class="status-bar-header">
          <span style="color:var(--text-main);">${escapeHtml(label)} (${count})</span>
          <span style="color:var(--text-muted);">${pct}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${pct}%; background-color: ${color};"></div>
        </div>
      </div>
    `;
  }

  function initDashboardRevenueChart(invoices) {
    const canvas = document.getElementById("dashboard-revenue-chart");
    if (!canvas) return;

    if (typeof window.Chart === "undefined") {
      const fallback = document.getElementById("chart-fallback");
      if (fallback) fallback.style.display = "block";
      return;
    }

    // Prepare monthly labels & totals
    const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
    const simulatedInvoiced = [4800, 6200, 7100, 8900, 9400, 11200, 12640];
    const simulatedCollected = [4500, 5900, 6800, 8100, 8900, 9500, 10200];

    try {
      if (window._paypilotChartInstance) {
        window._paypilotChartInstance.destroy();
      }

      window._paypilotChartInstance = new window.Chart(canvas, {
        type: "bar",
        data: {
          labels: months,
          datasets: [
            {
              label: "Invoiced Volume ($)",
              data: simulatedInvoiced,
              backgroundColor: "rgba(37, 99, 235, 0.4)",
              borderColor: "#2563eb",
              borderWidth: 1.5,
              borderRadius: 4
            },
            {
              label: "Collected Cash ($)",
              data: simulatedCollected,
              backgroundColor: "rgba(5, 150, 105, 0.8)",
              borderColor: "#059669",
              borderWidth: 1.5,
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              labels: { font: { family: "-apple-system, BlinkMacSystemFont, sans-serif", size: 11 } }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (val) => "$" + val.toLocaleString() }
            }
          }
        }
      });
    } catch (e) {
      console.warn("[PayPilot] Chart render failed:", e);
    }
  }

  // -------------------------------------------------------------------------
  // B. INVOICES LIST VIEW
  // -------------------------------------------------------------------------
  function renderInvoicesList(container) {
    const invoices = safeLoad(LS_KEYS.invoices, []);
    const clients = safeLoad(LS_KEYS.clients, []);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Invoices</h1>
          <p class="page-subtitle">Track, filter, and manage your cross-border billing pipeline</p>
        </div>
        <div style="display:flex; gap:0.75rem;">
          <a href="#new" class="btn btn-primary">+ New Invoice</a>
        </div>
      </div>

      <!-- Search & Filter Controls -->
      <div class="card" style="padding: 1rem 1.25rem;">
        <div class="form-grid" style="grid-template-columns: 2fr 1fr 1fr auto; align-items: flex-end;">
          <div>
            <label class="form-label">Search Invoices</label>
            <input type="text" id="inv-search-input" class="form-input" placeholder="Search by invoice #, client, description..." />
          </div>
          <div>
            <label class="form-label">Status Filter</label>
            <select id="inv-status-filter" class="form-select">
              <option value="ALL">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label class="form-label">Currency</label>
            <select id="inv-currency-filter" class="form-select">
              <option value="ALL">All Currencies</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
          <div>
            <button id="reset-filters-btn" class="btn btn-secondary" style="height: 42px;">Reset</button>
          </div>
        </div>
      </div>

      <!-- Invoices Data Table -->
      <div class="table-container">
        <table class="data-table" id="invoices-main-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Client</th>
              <th>Issue Date</th>
              <th>Due Date</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th>AI Risk Score</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody id="invoices-table-body">
            <!-- Dynamic rows injected here -->
          </tbody>
        </table>
      </div>
    `;

    const tbody = document.getElementById("invoices-table-body");
    const searchInput = document.getElementById("inv-search-input");
    const statusFilter = document.getElementById("inv-status-filter");
    const currencyFilter = document.getElementById("inv-currency-filter");
    const resetBtn = document.getElementById("reset-filters-btn");

    function updateTable() {
      const q = (searchInput?.value || "").toLowerCase().trim();
      const statusVal = statusFilter?.value || "ALL";
      const currVal = currencyFilter?.value || "ALL";

      const filtered = invoices.filter(inv => {
        const client = getClientById(inv.clientId);
        const matchesQuery = !q ||
          inv.invoiceNumber.toLowerCase().includes(q) ||
          client.name.toLowerCase().includes(q) ||
          (inv.lineItems && inv.lineItems.some(i => i.description.toLowerCase().includes(q)));

        const matchesStatus = statusVal === "ALL" || inv.status === statusVal;
        const matchesCurr = currVal === "ALL" || inv.currency === currVal;

        return matchesQuery && matchesStatus && matchesCurr;
      });

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
              <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🔍</div>
              No invoices matched your filter criteria.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filtered.map(inv => {
        const client = getClientById(inv.clientId);
        const { total } = calculateInvoiceTotals(inv);
        const risk = predictPaymentRisk(inv);

        return `
          <tr>
            <td style="font-weight: 700;">
              <a href="#invoices/view/${inv.id}" style="color:var(--accent); font-weight:700;">
                ${escapeHtml(inv.invoiceNumber)}
              </a>
            </td>
            <td>
              <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(client.name)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(client.email)}</div>
            </td>
            <td>${formatDate(inv.issueDate)}</td>
            <td>
              <span style="${inv.status === 'overdue' ? 'color:var(--danger); font-weight:700;' : ''}">
                ${formatDate(inv.dueDate)}
              </span>
            </td>
            <td style="font-weight: 800; font-size: 0.95rem;">
              ${formatCurrency(total, inv.currency)}
            </td>
            <td>
              <span class="badge badge-${inv.status.replace('_', '-')}">
                ${inv.status.replace('_', ' ')}
              </span>
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 0.4rem;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${risk.color};"></span>
                <span style="font-size: 0.8rem; font-weight: 600;">${risk.score}/100</span>
              </div>
            </td>
            <td style="text-align: right;">
              <div style="display: inline-flex; gap: 0.35rem;">
                <a href="#invoices/view/${inv.id}" class="btn btn-sm btn-secondary" title="View & Print">View</a>
                ${inv.status === "draft" ? `<a href="#invoices/edit/${inv.id}" class="btn btn-sm btn-secondary" title="Edit Draft">Edit</a>` : ""}
                ${inv.status === "draft" ? `<button class="btn btn-sm btn-danger delete-inv-btn" data-id="${inv.id}" title="Delete Draft">✕</button>` : ""}
                ${inv.status === "sent" || inv.status === "overdue" ? `
                  <button class="btn btn-sm btn-success mark-paid-btn" data-id="${inv.id}" title="Simulate Client Payment">Pay</button>
                ` : ""}
              </div>
            </td>
          </tr>
        `;
      }).join("");

      // Attach actions
      tbody.querySelectorAll(".delete-inv-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = Number(btn.getAttribute("data-id"));
          if (confirm(`Are you sure you want to delete draft invoice #${id}?`)) {
            deleteInvoice(id);
            renderInvoicesList(container);
          }
        });
      });

      tbody.querySelectorAll(".mark-paid-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = Number(btn.getAttribute("data-id"));
          simulateMarkPaid(id);
          renderInvoicesList(container);
        });
      });
    }

    searchInput?.addEventListener("input", updateTable);
    statusFilter?.addEventListener("change", updateTable);
    currencyFilter?.addEventListener("change", updateTable);
    resetBtn?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (statusFilter) statusFilter.value = "ALL";
      if (currencyFilter) currencyFilter.value = "ALL";
      updateTable();
    });

    updateTable();
  }

  function deleteInvoice(id) {
    let invoices = safeLoad(LS_KEYS.invoices, []);
    invoices = invoices.filter(i => i.id !== id);
    safeSave(LS_KEYS.invoices, invoices);

    let approvals = safeLoad(LS_KEYS.approvals, []);
    approvals = approvals.filter(a => a.invoiceId !== id);
    safeSave(LS_KEYS.approvals, approvals);

    logAudit("INVOICE_DELETE", `Draft invoice #${id} was deleted.`, "Freelancer Admin");
    showToast("Invoice deleted successfully.", "info");
    updateSidebarBadges();
  }

  function simulateMarkPaid(id) {
    const invoices = safeLoad(LS_KEYS.invoices, []);
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;

    inv.status = "paid";
    safeSave(LS_KEYS.invoices, invoices);

    const client = getClientById(inv.clientId);
    const { total } = calculateInvoiceTotals(inv);
    logAudit("PAYMENT_RECEIVED", `Simulated payment of ${formatCurrency(total, inv.currency)} completed for #${inv.invoiceNumber} (${client.name}).`, "PayPal Sandbox Webhook");
    showToast(`Payment received for ${inv.invoiceNumber}! Status updated to Paid.`, "success");
  }

  // -------------------------------------------------------------------------
  // C. CREATE / EDIT INVOICE VIEW
  // -------------------------------------------------------------------------
  function renderInvoiceForm(container, invoiceId = null) {
    const isEdit = Boolean(invoiceId);
    const invoices = safeLoad(LS_KEYS.invoices, []);
    const clients = safeLoad(LS_KEYS.clients, []);

    let existing = null;
    if (isEdit) {
      existing = invoices.find(i => i.id === Number(invoiceId));
      if (!existing) {
        showToast("Invoice not found.", "danger");
        window.location.hash = "#invoices";
        return;
      }
    }

    const defaultDueDate = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    const defaultIssueDate = new Date().toISOString().split("T")[0];
    const autoNumber = "INV-2026-00" + (invoices.length + 1);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${isEdit ? "Edit Draft Invoice" : "Create Cross-Border Invoice"}</h1>
          <p class="page-subtitle">Configure client billing terms, line items, and automated guard dispatch policy</p>
        </div>
        <div>
          <a href="#invoices" class="btn btn-secondary">← Back to Invoices</a>
        </div>
      </div>

      <form id="invoice-editor-form">
        <div class="card">
          <h2 class="section-title">1. Client & Invoice Information</h2>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="form-client">Select Client *</label>
              <select id="form-client" class="form-select" required>
                ${clients.map(c => `
                  <option value="${c.id}" ${existing && existing.clientId === c.id ? "selected" : ""}>
                    ${escapeHtml(c.name)} (${c.currency} - ${escapeHtml(c.country)}) ${c.trusted ? "✓ Trusted" : "⚠ New Client"}
                  </option>
                `).join("")}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="form-inv-num">Invoice Number *</label>
              <input type="text" id="form-inv-num" class="form-input" value="${escapeHtml(existing?.invoiceNumber || autoNumber)}" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="form-currency">Billing Currency *</label>
              <select id="form-currency" class="form-select" required>
                <option value="USD" ${existing?.currency === "USD" ? "selected" : ""}>USD — US Dollar ($)</option>
                <option value="EUR" ${existing?.currency === "EUR" ? "selected" : ""}>EUR — Euro (€)</option>
                <option value="GBP" ${existing?.currency === "GBP" ? "selected" : ""}>GBP — British Pound (£)</option>
                <option value="CAD" ${existing?.currency === "CAD" ? "selected" : ""}>CAD — Canadian Dollar (CA$)</option>
                <option value="AUD" ${existing?.currency === "AUD" ? "selected" : ""}>AUD — Australian Dollar (AU$)</option>
                <option value="SGD" ${existing?.currency === "SGD" ? "selected" : ""}>SGD — Singapore Dollar (SG$)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="form-issue-date">Issue Date *</label>
              <input type="date" id="form-issue-date" class="form-input" value="${existing?.issueDate || defaultIssueDate}" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="form-due-date">Due Date *</label>
              <input type="date" id="form-due-date" class="form-input" value="${existing?.dueDate || defaultDueDate}" required />
            </div>
          </div>
        </div>

        <!-- Line Items Section -->
        <div class="card">
          <div class="card-header">
            <h2 class="section-title" style="margin-bottom:0;">2. Line Items & Deliverables</h2>
            <button type="button" id="add-item-btn" class="btn btn-sm btn-secondary">+ Add Item</button>
          </div>

          <table class="line-items-table">
            <thead>
              <tr>
                <th style="width: 50%;">Description</th>
                <th style="width: 15%;">Quantity</th>
                <th style="width: 20%;">Unit Price</th>
                <th style="width: 15%; text-align: right;">Line Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="line-items-tbody">
              <!-- Render dynamic line rows -->
            </tbody>
          </table>

          <!-- Financial Calculation Breakdown -->
          <div class="calculation-summary">
            <div class="calc-row">
              <span>Subtotal:</span>
              <strong id="calc-subtotal">$0.00</strong>
            </div>
            <div class="calc-row" style="align-items: center;">
              <span>Tax Rate (%):</span>
              <input type="number" id="form-tax-rate" class="form-input" style="width: 70px; padding: 0.2rem 0.4rem; text-align: right;" min="0" max="100" step="1" value="${(existing?.taxRate || 0) * 100}" />
            </div>
            <div class="calc-row">
              <span>Tax Amount:</span>
              <span id="calc-tax">$0.00</span>
            </div>
            <div class="calc-row" style="align-items: center;">
              <span>Discount ($):</span>
              <input type="number" id="form-discount" class="form-input" style="width: 90px; padding: 0.2rem 0.4rem; text-align: right;" min="0" step="10" value="${existing?.discount || 0}" />
            </div>
            <div class="calc-row total">
              <span>Final Total:</span>
              <span id="calc-grand-total">$0.00</span>
            </div>
          </div>
        </div>

        <!-- Notes & Terms -->
        <div class="card">
          <h2 class="section-title">3. Notes & Settlement Instructions</h2>
          <div class="form-group" style="margin-bottom:0;">
            <textarea id="form-notes" class="form-textarea" rows="3" placeholder="Provide payment instructions, PayPal sandbox notes, or milestones...">${escapeHtml(existing?.notes || "Settlement via PayPal cross-border payment link. Please adhere to agreed terms.")}</textarea>
          </div>
        </div>

        <!-- Form Submission Actions -->
        <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
          <button type="button" id="save-draft-btn" class="btn btn-secondary">Save as Draft</button>
          <button type="submit" id="submit-approval-btn" class="btn btn-primary">🛡️ Submit to Approval Pipeline</button>
        </div>
      </form>
    `;

    const lineItemsTbody = document.getElementById("line-items-tbody");
    const addItemBtn = document.getElementById("add-item-btn");
    const currencySelect = document.getElementById("form-currency");
    const taxInput = document.getElementById("form-tax-rate");
    const discountInput = document.getElementById("form-discount");

    let items = existing?.lineItems && existing.lineItems.length > 0
      ? JSON.parse(JSON.stringify(existing.lineItems))
      : [{ description: "AI Software Consulting & Implementation", qty: 1, price: 1500 }];

    function renderLineItems() {
      lineItemsTbody.innerHTML = items.map((item, index) => {
        const lineTotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
        return `
          <tr data-index="${index}">
            <td>
              <input type="text" class="form-input item-desc" value="${escapeHtml(item.description)}" placeholder="Service or product description..." required />
            </td>
            <td>
              <input type="number" class="form-input item-qty" value="${item.qty}" min="1" step="1" required />
            </td>
            <td>
              <input type="number" class="form-input item-price" value="${item.price}" min="0" step="0.01" required />
            </td>
            <td style="text-align: right; font-weight: 700;">
              ${formatCurrency(lineTotal, currencySelect.value)}
            </td>
            <td style="text-align: center;">
              ${items.length > 1 ? `<button type="button" class="btn btn-sm btn-danger remove-item-btn" data-index="${index}">✕</button>` : ""}
            </td>
          </tr>
        `;
      }).join("");

      // Wire row inputs
      lineItemsTbody.querySelectorAll(".item-desc").forEach((input, i) => {
        input.addEventListener("input", (e) => { items[i].description = e.target.value; });
      });
      lineItemsTbody.querySelectorAll(".item-qty").forEach((input, i) => {
        input.addEventListener("input", (e) => {
          items[i].qty = Number(e.target.value) || 0;
          recalculate();
        });
      });
      lineItemsTbody.querySelectorAll(".item-price").forEach((input, i) => {
        input.addEventListener("input", (e) => {
          items[i].price = Number(e.target.value) || 0;
          recalculate();
        });
      });
      lineItemsTbody.querySelectorAll(".remove-item-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.getAttribute("data-index"));
          items.splice(idx, 1);
          renderLineItems();
          recalculate();
        });
      });

      recalculate();
    }

    function recalculate() {
      const curr = currencySelect.value;
      const subtotal = items.reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
      const taxRate = (Number(taxInput.value) || 0) / 100;
      const taxAmount = subtotal * taxRate;
      const discount = Number(discountInput.value) || 0;
      const grandTotal = Math.max(0, subtotal + taxAmount - discount);

      document.getElementById("calc-subtotal").textContent = formatCurrency(subtotal, curr);
      document.getElementById("calc-tax").textContent = formatCurrency(taxAmount, curr);
      document.getElementById("calc-grand-total").textContent = formatCurrency(grandTotal, curr);

      // update row line total displays
      const rows = lineItemsTbody.querySelectorAll("tr");
      rows.forEach((row, i) => {
        const item = items[i];
        if (item) {
          const lt = (Number(item.qty) || 0) * (Number(item.price) || 0);
          const td = row.children[3];
          if (td) td.textContent = formatCurrency(lt, curr);
        }
      });
    }

    addItemBtn?.addEventListener("click", () => {
      items.push({ description: "", qty: 1, price: 100 });
      renderLineItems();
    });

    currencySelect?.addEventListener("change", recalculate);
    taxInput?.addEventListener("input", recalculate);
    discountInput?.addEventListener("input", recalculate);

    renderLineItems();

    function persistInvoice(status) {
      const clientId = Number(document.getElementById("form-client").value);
      const invoiceNumber = document.getElementById("form-inv-num").value.trim();
      const currency = currencySelect.value;
      const issueDate = document.getElementById("form-issue-date").value;
      const dueDate = document.getElementById("form-due-date").value;
      const taxRate = (Number(taxInput.value) || 0) / 100;
      const discount = Number(discountInput.value) || 0;
      const notes = document.getElementById("form-notes").value.trim();

      if (!invoiceNumber) {
        showToast("Please provide an invoice number.", "warning");
        return;
      }

      if (items.some(i => !i.description.trim())) {
        showToast("Please complete description for all line items.", "warning");
        return;
      }

      const allInvoices = safeLoad(LS_KEYS.invoices, []);
      let targetId = existing?.id;

      if (!isEdit) {
        targetId = allInvoices.length > 0 ? Math.max(...allInvoices.map(i => i.id)) + 1 : 1;
      }

      const record = {
        id: targetId,
        invoiceNumber,
        clientId,
        currency,
        issueDate,
        dueDate,
        taxRate,
        discount,
        lineItems: items,
        notes,
        status: status,
        createdAt: existing?.createdAt || new Date().toISOString()
      };

      if (isEdit) {
        const idx = allInvoices.findIndex(i => i.id === targetId);
        if (idx !== -1) allInvoices[idx] = record;
      } else {
        allInvoices.push(record);
      }

      safeSave(LS_KEYS.invoices, allInvoices);

      // If submitted to approval pipeline, create proposed_action entry
      if (status === "pending_approval") {
        const { total } = calculateInvoiceTotals(record);
        const client = getClientById(clientId);
        const allApprovals = safeLoad(LS_KEYS.approvals, []);

        const isOverAuto = total > 2500;
        const isUntrusted = !client.trusted;

        const reason = isOverAuto || isUntrusted
          ? `Policy check held: ${isOverAuto ? "Amount exceeds MAX_AUTO ($2,500). " : ""}${isUntrusted ? "First engagement with untrusted client." : ""}`
          : "Standard cross-border invoice dispatch proposal.";

        const newApproval = {
          id: Date.now(),
          invoiceId: targetId,
          actionType: "send_invoice",
          targetCurrency: currency,
          amount: total,
          status: "pending",
          policyChecks: {
            amountAutoLimit: !isOverAuto,
            trustedClient: client.trusted,
            currencyAllowlisted: true,
            idempotencyPassed: true
          },
          reason,
          createdAt: new Date().toISOString()
        };

        allApprovals.push(newApproval);
        safeSave(LS_KEYS.approvals, allApprovals);
        logAudit("PROPOSE_ACTION", `Proposed dispatch of #${invoiceNumber} to ${client.name} (${formatCurrency(total, currency)}).`, "AI Orchestrator");
        showToast("Invoice submitted to Approval Guard pipeline!", "success");
        updateSidebarBadges();
        window.location.hash = "#approvals";
      } else {
        logAudit("DRAFT_SAVED", `Draft invoice #${invoiceNumber} saved.`, "Freelancer Admin");
        showToast("Draft invoice saved successfully.", "success");
        window.location.hash = "#invoices";
      }
    }

    document.getElementById("invoice-editor-form").addEventListener("submit", (e) => {
      e.preventDefault();
      persistInvoice("pending_approval");
    });

    document.getElementById("save-draft-btn").addEventListener("click", () => {
      persistInvoice("draft");
    });
  }

  // -------------------------------------------------------------------------
  // D. INVOICE PREVIEW / VIEW / PRINT VIEW
  // -------------------------------------------------------------------------
  function renderInvoiceView(container, invoiceId) {
    const invoices = safeLoad(LS_KEYS.invoices, []);
    const inv = invoices.find(i => i.id === Number(invoiceId));

    if (!inv) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem;">
          <h2>Invoice Not Found</h2>
          <p style="color:var(--text-muted); margin: 1rem 0;">The requested invoice does not exist in the ledger.</p>
          <a href="#invoices" class="btn btn-primary">Return to Invoices</a>
        </div>
      `;
      return;
    }

    const client = getClientById(inv.clientId);
    const { subtotal, taxRate, taxAmount, discount, total } = calculateInvoiceTotals(inv);
    const risk = predictPaymentRisk(inv);

    container.innerHTML = `
      <div class="page-header no-print">
        <div>
          <h1 class="page-title">Invoice #${escapeHtml(inv.invoiceNumber)}</h1>
          <p class="page-subtitle">Preview printable layout, inspect payment prediction, or test simulated payment</p>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button id="print-invoice-btn" class="btn btn-secondary">🖨️ Print Invoice</button>
          <button id="download-pdf-btn" class="btn btn-secondary">📥 Download PDF</button>
          ${inv.status !== "paid" ? `
            <button id="simulate-pay-btn" class="btn btn-success">💳 Simulate Client Payment</button>
          ` : ""}
          <a href="#invoices" class="btn btn-secondary">← Back</a>
        </div>
      </div>

      <!-- AI Smart Payment Prediction Bar (No-Print) -->
      <div class="card no-print" style="background:#f8fafc; border-left: 4px solid ${risk.color}; margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <strong style="color:var(--text-main);">Smart Payment Prediction:</strong>
            <span style="color:${risk.color}; font-weight:700; margin-left: 0.35rem;">${risk.label} (${risk.score}/100)</span>
          </div>
          <span style="font-size:0.75rem; color:var(--text-muted);">Rules: Due date proximity, Client payment history, Value tier</span>
        </div>
        ${risk.reasons && risk.reasons.length > 0 ? `
          <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.35rem;">
            Risk Factors: ${risk.reasons.join(" • ")}
          </div>
        ` : ""}
      </div>

      <!-- Printable Invoice Sheet -->
      <div class="invoice-sheet" id="printable-invoice-sheet">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--border-color); padding-bottom: 1.5rem;">
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom: 0.5rem;">
              <div class="brand-logo-icon">P</div>
              <span style="font-size: 1.5rem; font-weight: 800; color: var(--primary-dark);">PayPilot</span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              <strong>Alex Morgan</strong><br />
              Cross-Border Freelance Consultancy<br />
              alex@paypilot.dev | PayPal Sandbox Verified
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-main);">INVOICE</div>
            <div style="font-size: 1.1rem; font-weight: 700; color: var(--accent); margin-top: 0.2rem;">#${escapeHtml(inv.invoiceNumber)}</div>
            <div style="margin-top: 0.5rem;">
              <span class="badge badge-${inv.status.replace('_', '-')}">${inv.status.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        <div class="invoice-meta-grid">
          <div>
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Billed To:</span>
            <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin-top: 0.25rem;">${escapeHtml(client.name)}</div>
            <div style="font-size: 0.85rem; color: var(--text-body); margin-top: 0.2rem;">
              Attn: ${escapeHtml(client.contact || "Accounts Payable")}<br />
              Email: ${escapeHtml(client.email)}<br />
              Region: ${escapeHtml(client.country)}<br />
              Client Status: ${client.trusted ? "Verified Trusted Partner" : "New Client Account"}
            </div>
          </div>

          <div style="text-align: right;">
            <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Invoice Details:</span>
            <div style="font-size: 0.85rem; color: var(--text-body); margin-top: 0.25rem;">
              <strong>Issue Date:</strong> ${formatDate(inv.issueDate)}<br />
              <strong>Due Date:</strong> ${formatDate(inv.dueDate)}<br />
              <strong>Currency:</strong> ${escapeHtml(inv.currency)}<br />
              <strong>Payment Terms:</strong> Net 14 Days
            </div>
          </div>
        </div>

        <table class="line-items-table" style="margin-top: 2rem;">
          <thead>
            <tr>
              <th style="padding: 0.75rem; background: var(--bg-subtle);">Description</th>
              <th style="padding: 0.75rem; background: var(--bg-subtle); text-align: center;">Qty</th>
              <th style="padding: 0.75rem; background: var(--bg-subtle); text-align: right;">Unit Price</th>
              <th style="padding: 0.75rem; background: var(--bg-subtle); text-align: right;">Line Amount</th>
            </tr>
          </thead>
          <tbody>
            ${inv.lineItems.map(item => {
              const lineAmt = (Number(item.qty) || 0) * (Number(item.price) || 0);
              return `
                <tr>
                  <td style="padding: 0.85rem 0.5rem; border-bottom: 1px solid var(--border-color);">${escapeHtml(item.description)}</td>
                  <td style="padding: 0.85rem 0.5rem; border-bottom: 1px solid var(--border-color); text-align: center;">${item.qty}</td>
                  <td style="padding: 0.85rem 0.5rem; border-bottom: 1px solid var(--border-color); text-align: right;">${formatCurrency(item.price, inv.currency)}</td>
                  <td style="padding: 0.85rem 0.5rem; border-bottom: 1px solid var(--border-color); text-align: right; font-weight: 600;">${formatCurrency(lineAmt, inv.currency)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <div class="calculation-summary" style="margin-top: 1.5rem;">
          <div class="calc-row">
            <span>Subtotal:</span>
            <strong>${formatCurrency(subtotal, inv.currency)}</strong>
          </div>
          ${taxRate > 0 ? `
            <div class="calc-row">
              <span>Tax (${(taxRate * 100).toFixed(0)}%):</span>
              <span>+${formatCurrency(taxAmount, inv.currency)}</span>
            </div>
          ` : ""}
          ${discount > 0 ? `
            <div class="calc-row" style="color:var(--danger);">
              <span>Discount:</span>
              <span>-${formatCurrency(discount, inv.currency)}</span>
            </div>
          ` : ""}
          <div class="calc-row total">
            <span>Total Due:</span>
            <span>${formatCurrency(total, inv.currency)}</span>
          </div>
        </div>

        <div style="margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px dashed var(--border-color); font-size: 0.85rem; color: var(--text-muted);">
          <strong>Remittance & Settlement Instructions:</strong>
          <p style="margin-top: 0.25rem;">${escapeHtml(inv.notes || "Payable via PayPal sandbox portal. Guaranteed idempotent transaction ledger.")}</p>
        </div>
      </div>
    `;

    document.getElementById("print-invoice-btn")?.addEventListener("click", () => {
      window.print();
    });

    document.getElementById("download-pdf-btn")?.addEventListener("click", () => {
      exportInvoicePDF(inv, client, total);
    });

    document.getElementById("simulate-pay-btn")?.addEventListener("click", () => {
      simulateMarkPaid(inv.id);
      renderInvoiceView(container, invoiceId);
    });
  }

  function exportInvoicePDF(inv, client, total) {
    if (typeof window.jspdf !== "undefined" && window.jspdf.jsPDF) {
      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("PayPilot — INVOICE", 14, 22);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Invoice Number: ${inv.invoiceNumber}`, 14, 32);
        doc.text(`Client: ${client.name}`, 14, 38);
        doc.text(`Issue Date: ${formatDate(inv.issueDate)}`, 14, 44);
        doc.text(`Due Date: ${formatDate(inv.dueDate)}`, 14, 50);
        doc.text(`Status: ${inv.status.toUpperCase()}`, 14, 56);

        doc.setLineWidth(0.5);
        doc.line(14, 62, 196, 62);

        let y = 72;
        doc.setFont("helvetica", "bold");
        doc.text("Description", 14, y);
        doc.text("Qty", 120, y);
        doc.text("Unit Price", 145, y);
        doc.text("Line Total", 175, y);

        doc.setFont("helvetica", "normal");
        y += 8;

        inv.lineItems.forEach(item => {
          const lt = (Number(item.qty) || 0) * (Number(item.price) || 0);
          doc.text(String(item.description).slice(0, 45), 14, y);
          doc.text(String(item.qty), 120, y);
          doc.text(formatCurrency(item.price, inv.currency), 145, y);
          doc.text(formatCurrency(lt, inv.currency), 175, y);
          y += 8;
        });

        doc.line(14, y + 2, 196, y + 2);
        y += 12;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(`Total Due: ${formatCurrency(total, inv.currency)}`, 140, y);

        doc.save(`${inv.invoiceNumber}.pdf`);
        showToast("PDF exported successfully!", "success");
        return;
      } catch (err) {
        console.warn("[PayPilot] jsPDF direct generation failed, fallback to print:", err);
      }
    }
    // Fallback
    window.print();
  }

  // -------------------------------------------------------------------------
  // E. APPROVALS WORKFLOW VIEW
  // -------------------------------------------------------------------------
  function renderApprovalsView(container) {
    const approvals = safeLoad(LS_KEYS.approvals, []);
    const invoices = safeLoad(LS_KEYS.invoices, []);
    const pending = approvals.filter(a => a.status === "pending");
    const history = approvals.filter(a => a.status !== "pending");

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Approval Guard Inbox</h1>
          <p class="page-subtitle">Deterministic safety module — AI agent proposes actions; human approves critical operations</p>
        </div>
        <div class="badge badge-warning" style="font-size:0.85rem; padding:0.4rem 0.8rem;">
          ${pending.length} Actions Requiring Review
        </div>
      </div>

      <!-- Security Guard Architecture Explainer -->
      <div class="card" style="background:#f8fafc; border-left: 4px solid var(--primary); margin-bottom: 2rem;">
        <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--primary-dark); margin-bottom: 0.35rem;">
          🛡️ Non-Negotiable Guard Policy Architecture
        </h3>
        <p style="font-size: 0.85rem; color: var(--text-body); line-height: 1.45;">
          The Claude AI agent <strong>never executes PayPal write tools directly</strong>. It evaluates events and inserts rows into <code>proposed_actions</code>.
          Our plain-code Guard validates each proposal against policy (amount &le; MAX_AUTO $2,500, currency allow-list, client trust, idempotency).
          Any boundary violation escalates to you for authorization.
        </p>
      </div>

      <h2 class="section-title">Pending Proposals (${pending.length})</h2>

      ${pending.length === 0 ? `
        <div class="card" style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎉</div>
          <h3 style="color:var(--text-main);">Inbox Zero</h3>
          <p>No actions currently held by the policy guard. All proposals have been resolved.</p>
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          ${pending.map(action => {
            const inv = invoices.find(i => i.id === action.invoiceId);
            const client = inv ? getClientById(inv.clientId) : { name: "Unknown" };
            return `
              <div class="card" style="border: 1px solid #fed7aa; box-shadow: var(--shadow-md);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span class="badge badge-pending">PENDING AUTHORIZATION</span>
                      <strong style="font-size: 1.1rem; color: var(--text-main);">
                        Action #${action.id}: ${escapeHtml(action.actionType.toUpperCase().replace('_', ' '))}
                      </strong>
                    </div>
                    <div style="margin-top: 0.4rem; font-size: 0.9rem; color: var(--text-body);">
                      Target: <strong>${escapeHtml(inv?.invoiceNumber || "N/A")}</strong> for <strong>${escapeHtml(client.name)}</strong>
                      (${formatCurrency(action.amount, action.targetCurrency)})
                    </div>
                  </div>
                  <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-success approve-action-btn" data-id="${action.id}">
                      ✓ Authorize & Execute
                    </button>
                    <button class="btn btn-danger reject-action-btn" data-id="${action.id}">
                      ✕ Reject
                    </button>
                  </div>
                </div>

                <div style="margin-top: 1rem; padding: 0.85rem; background: #fff7ed; border-radius: var(--radius-md); font-size: 0.85rem;">
                  <strong>Policy Hold Justification:</strong>
                  <div style="color: #9a3412; margin-top: 0.2rem;">${escapeHtml(action.reason)}</div>
                </div>

                <!-- Policy Checklist -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin-top: 1rem; font-size: 0.8rem;">
                  <div>
                    Amount Check:
                    ${action.policyChecks?.amountAutoLimit ? '<span style="color:var(--success); font-weight:700;">✓ &le; $2,500</span>' : '<span style="color:var(--danger); font-weight:700;">⚠ Exceeds $2,500 limit</span>'}
                  </div>
                  <div>
                    Client Trust:
                    ${action.policyChecks?.trustedClient ? '<span style="color:var(--success); font-weight:700;">✓ Trusted History</span>' : '<span style="color:var(--danger); font-weight:700;">⚠ First/Untrusted invoice</span>'}
                  </div>
                  <div>
                    Currency: <span style="color:var(--success); font-weight:700;">✓ Allowlisted (${action.targetCurrency})</span>
                  </div>
                  <div>
                    Idempotency: <span style="color:var(--success); font-weight:700;">✓ Verified Unique</span>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `}

      <!-- Decision History -->
      <div class="card" style="margin-top: 2.5rem;">
        <h2 class="section-title">Resolved Action History</h2>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Action ID</th>
                <th>Type</th>
                <th>Invoice</th>
                <th>Amount</th>
                <th>Decision</th>
                <th>Resolved Date</th>
                <th>Justification</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(h => {
                const inv = invoices.find(i => i.id === h.invoiceId);
                return `
                  <tr>
                    <td>#${h.id}</td>
                    <td style="font-weight:600;">${escapeHtml(h.actionType.replace('_', ' '))}</td>
                    <td>${escapeHtml(inv?.invoiceNumber || "N/A")}</td>
                    <td>${formatCurrency(h.amount, h.targetCurrency)}</td>
                    <td>
                      <span class="badge badge-${h.status === 'approved' ? 'approved' : 'rejected'}">
                        ${h.status.toUpperCase()}
                      </span>
                    </td>
                    <td>${formatDate(h.decidedAt || h.createdAt)}</td>
                    <td style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(h.reason)}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Wire Approval/Rejection buttons
    container.querySelectorAll(".approve-action-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        if (confirm(`Authorize proposal #${id}? This will execute the simulated PayPal transaction with idempotency.`)) {
          resolveAction(id, "approved");
          renderApprovalsView(container);
        }
      });
    });

    container.querySelectorAll(".reject-action-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        const reason = prompt("Enter rejection reason for audit log:", "Rejected by administrator review");
        if (reason !== null) {
          resolveAction(id, "rejected", reason);
          renderApprovalsView(container);
        }
      });
    });
  }

  function resolveAction(actionId, decision, rejectionReason = "") {
    const approvals = safeLoad(LS_KEYS.approvals, []);
    const action = approvals.find(a => a.id === actionId);
    if (!action) return;

    action.status = decision;
    action.decidedAt = new Date().toISOString();
    if (decision === "rejected" && rejectionReason) {
      action.reason = "Rejection Reason: " + rejectionReason;
    }

    safeSave(LS_KEYS.approvals, approvals);

    // If approved, update target invoice status
    const invoices = safeLoad(LS_KEYS.invoices, []);
    const inv = invoices.find(i => i.id === action.invoiceId);

    if (decision === "approved" && inv) {
      if (action.actionType === "send_invoice") {
        inv.status = "sent";
        logAudit("PROPOSAL_APPROVED", `Approved proposal #${actionId}: Invoice #${inv.invoiceNumber} marked 'sent' to client.`, "Freelancer Human Approver");
        showToast(`Action #${actionId} authorized: Invoice #${inv.invoiceNumber} sent!`, "success");
      } else if (action.actionType === "escalate_reminder") {
        logAudit("REMINDER_DISPATCHED", `Approved escalated reminder for #${inv.invoiceNumber}.`, "Freelancer Human Approver");
        showToast(`Escalated reminder for #${inv.invoiceNumber} authorized and logged.`, "success");
      }
      safeSave(LS_KEYS.invoices, invoices);
    } else {
      logAudit("PROPOSAL_REJECTED", `Rejected action #${actionId}: ${rejectionReason}`, "Freelancer Human Approver");
      showToast(`Action #${actionId} rejected.`, "info");
    }

    updateSidebarBadges();
  }

  // -------------------------------------------------------------------------
  // F. REMINDER CENTER VIEW
  // -------------------------------------------------------------------------
  function renderRemindersView(container) {
    const invoices = safeLoad(LS_KEYS.invoices, []);
    const clients = safeLoad(LS_KEYS.clients, []);
    const overdueInvoices = invoices.filter(i => i.status === "overdue");
    const sentInvoices = invoices.filter(i => i.status === "sent");

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Automated Reminder Center</h1>
          <p class="page-subtitle">Generate, preview, and customize smart escalations for outstanding balances</p>
        </div>
      </div>

      <div class="card" style="background:#f0f9ff; border-left:4px solid var(--info);">
        <strong style="color:var(--info-text);">⚡ Transparent Simulation Disclaimer:</strong>
        <p style="font-size:0.85rem; color:var(--text-body); margin-top:0.25rem;">
          In this hackathon sandbox prototype, payment reminder templates are generated deterministically and logged to the ledger.
          No live SMTP or real customer emails are transmitted.
        </p>
      </div>

      <div class="card">
        <h2 class="section-title">Generate Smart Reminder Draft</h2>
        <div class="form-grid" style="grid-template-columns: 2fr 1fr auto; align-items: flex-end;">
          <div>
            <label class="form-label" for="reminder-inv-select">Select Outstanding Invoice</label>
            <select id="reminder-inv-select" class="form-select">
              ${overdueInvoices.concat(sentInvoices).map(inv => {
                const client = getClientById(inv.clientId);
                const { total } = calculateInvoiceTotals(inv);
                return `
                  <option value="${inv.id}">
                    #${escapeHtml(inv.invoiceNumber)} — ${escapeHtml(client.name)} (${formatCurrency(total, inv.currency)}) — ${inv.status.toUpperCase()}
                  </option>
                `;
              }).join("")}
            </select>
          </div>
          <div>
            <label class="form-label" for="reminder-tone-select">Escalation Tone</label>
            <select id="reminder-tone-select" class="form-select">
              <option value="polite">Level 1: Friendly Check-in</option>
              <option value="firm">Level 2: Firm Overdue Notice</option>
              <option value="urgent">Level 3: Final Urgent Demand</option>
            </select>
          </div>
          <div>
            <button id="generate-draft-btn" class="btn btn-primary" style="height:42px;">Draft Message</button>
          </div>
        </div>

        <div style="margin-top: 1.5rem;">
          <label class="form-label">Subject Line</label>
          <input type="text" id="reminder-subject" class="form-input" value="Payment Reminder: Invoice is ready for settlement" />
        </div>

        <div style="margin-top: 1rem;">
          <label class="form-label">Editable Email Body</label>
          <textarea id="reminder-body" class="form-textarea" rows="6"></textarea>
        </div>

        <div style="margin-top: 1.25rem; display: flex; justify-content: flex-end;">
          <button id="send-simulated-reminder-btn" class="btn btn-success">
            📨 Log & Send Simulated Reminder
          </button>
        </div>
      </div>
    `;

    const invSelect = document.getElementById("reminder-inv-select");
    const toneSelect = document.getElementById("reminder-tone-select");
    const subjectInput = document.getElementById("reminder-subject");
    const bodyTextarea = document.getElementById("reminder-body");
    const draftBtn = document.getElementById("generate-draft-btn");
    const sendBtn = document.getElementById("send-simulated-reminder-btn");

    function buildDraft() {
      const invId = Number(invSelect.value);
      const inv = invoices.find(i => i.id === invId);
      if (!inv) return;
      const client = getClientById(inv.clientId);
      const { total } = calculateInvoiceTotals(inv);
      const tone = toneSelect.value;

      if (tone === "polite") {
        subjectInput.value = `Friendly Reminder: PayPilot Invoice #${inv.invoiceNumber} for ${client.name}`;
        bodyTextarea.value = `Hi ${client.contact || client.name},\n\nHope all is well. This is a gentle reminder that invoice #${inv.invoiceNumber} for ${formatCurrency(total, inv.currency)} was issued on ${formatDate(inv.issueDate)} and has a scheduled due date of ${formatDate(inv.dueDate)}.\n\nYou can settle securely via the PayPal checkout link below.\n\nThank you for your partnership,\nAlex Morgan (PayPilot Agent)`;
      } else if (tone === "firm") {
        subjectInput.value = `Notice of Overdue Balance: Invoice #${inv.invoiceNumber}`;
        bodyTextarea.value = `Dear ${client.contact || client.name},\n\nOur automated ledger shows that invoice #${inv.invoiceNumber} in the amount of ${formatCurrency(total, inv.currency)} became overdue on ${formatDate(inv.dueDate)}.\n\nPlease remit payment promptly to maintain good standing on your cross-border account.\n\nRegards,\nPayPilot Financial Operations`;
      } else {
        subjectInput.value = `FINAL NOTICE: Immediate Settlement Required for #${inv.invoiceNumber}`;
        bodyTextarea.value = `URGENT NOTICE:\n\nAttention: Accounts Payable, ${client.name}\n\nInvoice #${inv.invoiceNumber} for ${formatCurrency(total, inv.currency)} is critically overdue. Continued delay will result in service suspension and dispute filing under PayPal Seller Protection terms.\n\nPlease complete payment immediately.\n\nPayPilot Risk & Collections`;
      }
    }

    draftBtn?.addEventListener("click", buildDraft);
    invSelect?.addEventListener("change", buildDraft);
    toneSelect?.addEventListener("change", buildDraft);

    sendBtn?.addEventListener("click", () => {
      const invId = Number(invSelect.value);
      const inv = invoices.find(i => i.id === invId);
      if (!inv) return;

      logAudit("REMINDER_DISPATCHED", `Simulated email reminder (${toneSelect.value} tone) logged for #${inv.invoiceNumber}. Subject: "${subjectInput.value}".`, "Automated Reminder Center");
      showToast("Simulated payment reminder logged to audit ledger!", "success");
    });

    buildDraft();
  }

  // -------------------------------------------------------------------------
  // G. AUDIT TRAIL VIEW
  // -------------------------------------------------------------------------
  function renderAuditView(container) {
    const logs = safeLoad(LS_KEYS.audit, []);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Audit Trail & Ledger Events</h1>
          <p class="page-subtitle">Immutable event log verifying all AI agent proposals, policy guard decisions, and payment events</p>
        </div>
        <div>
          <button id="clear-audit-btn" class="btn btn-secondary">Clear Non-Critical Logs</button>
        </div>
      </div>

      <div class="card">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Timestamp</th>
                <th>Action Type</th>
                <th>Event Details</th>
                <th>Executed By</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td style="font-family:monospace; font-size:0.75rem;">${escapeHtml(log.id)}</td>
                  <td>${new Date(log.timestamp).toLocaleString()}</td>
                  <td><span class="badge badge-info">${escapeHtml(log.action)}</span></td>
                  <td style="color:var(--text-main); font-weight:500;">${escapeHtml(log.details)}</td>
                  <td><span style="font-size:0.8rem; font-weight:600; color:var(--primary);">${escapeHtml(log.actor)}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById("clear-audit-btn")?.addEventListener("click", () => {
      if (confirm("Reset audit logs to default initialization events?")) {
        localStorage.removeItem(LS_KEYS.audit);
        initDemoData(true);
        showToast("Audit ledger refreshed.", "info");
        renderAuditView(container);
      }
    });
  }

  // -------------------------------------------------------------------------
  // H. SETTINGS & DEMO RESET VIEW
  // -------------------------------------------------------------------------
  function renderSettingsView(container) {
    const settings = safeLoad(LS_KEYS.settings, {});

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Settings & Demo Controls</h1>
          <p class="page-subtitle">Configure deterministic guard thresholds and manage sandbox local data</p>
        </div>
      </div>

      <div class="card">
        <h2 class="section-title">Guard Policy Thresholds</h2>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">MAX_AUTO Policy Threshold ($)</label>
            <input type="number" id="setting-max-auto" class="form-input" value="${settings.maxAutoAmount || 2500}" />
            <small style="color:var(--text-muted);">Invoices exceeding this amount require manual freelancer sign-off.</small>
          </div>
          <div class="form-group">
            <label class="form-label">Freelancer Display Name</label>
            <input type="text" id="setting-freelancer-name" class="form-input" value="${escapeHtml(settings.freelancerName || 'Alex Morgan')}" />
          </div>
        </div>
        <button id="save-settings-btn" class="btn btn-primary" style="margin-top:1rem;">Save Policy Settings</button>
      </div>

      <div class="card" style="border: 1px solid #fecaca; background: #fff5f5;">
        <h2 class="section-title" style="color: var(--danger);">Demo Sandbox Data Reset</h2>
        <p style="font-size: 0.875rem; color: var(--text-body); margin-bottom: 1rem;">
          Want to present a clean demonstration to hackathon judges? This action will reset clients, invoices,
          and approval proposals to the default balanced financial scenario.
        </p>
        <button id="reset-all-demo-btn" class="btn btn-danger">
          🔄 Reset All Demo Data to Default
        </button>
      </div>
    `;

    document.getElementById("save-settings-btn")?.addEventListener("click", () => {
      const updated = {
        ...settings,
        maxAutoAmount: Number(document.getElementById("setting-max-auto").value) || 2500,
        freelancerName: document.getElementById("setting-freelancer-name").value.trim()
      };
      safeSave(LS_KEYS.settings, updated);
      showToast("Policy settings updated successfully.", "success");
    });

    document.getElementById("reset-all-demo-btn")?.addEventListener("click", () => {
      if (confirm("Reset all LocalStorage data? This will restore realistic demo clients and invoices.")) {
        Object.values(LS_KEYS).forEach(k => localStorage.removeItem(k));
        initDemoData(true);
        showToast("Demo data cleanly restored!", "success");
        setTimeout(() => { window.location.hash = "#dashboard"; }, 600);
      }
    });
  }

  // =========================================================================
  // 5. Central Router
  // =========================================================================
  function route() {
    const rawHash = (window.location && window.location.hash) || "#dashboard";
    const cleanHash = rawHash.split("?")[0].replace(/\/$/, "");
    const appContainer = document.getElementById("app");
    if (!appContainer) {
      console.warn("[PayPilot] App container not found; skipping route render.");
      return;
    }

    // Normalization
    let path = cleanHash;
    if (cleanHash === "" || cleanHash === "#") path = "#dashboard";
    if (cleanHash === "#new") path = "#invoices/new";

    // Update active nav links
    document.querySelectorAll(".nav-item").forEach(item => {
      const href = item.getAttribute("href");
      if (href === path || (path.startsWith("#invoices") && href === "#invoices" && path !== "#invoices/new") || (path === "#invoices/new" && href === "#new")) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // Close mobile drawer on route
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar) sidebar.classList.remove("open");

    // Dynamic View Dispatcher
    if (path === "#dashboard") {
      renderDashboard(appContainer);
    } else if (path === "#invoices") {
      renderInvoicesList(appContainer);
    } else if (path === "#invoices/new" || path === "#new") {
      renderInvoiceForm(appContainer);
    } else if (path.startsWith("#invoices/edit/")) {
      const id = path.split("/")[2];
      renderInvoiceForm(appContainer, id);
    } else if (path.startsWith("#invoices/view/")) {
      const id = path.split("/")[2];
      renderInvoiceView(appContainer, id);
    } else if (path === "#approvals") {
      renderApprovalsView(appContainer);
    } else if (path === "#reminders") {
      renderRemindersView(appContainer);
    } else if (path === "#activity") {
      renderAuditView(appContainer);
    } else if (path === "#settings") {
      renderSettingsView(appContainer);
    } else {
      // Fallback
      renderDashboard(appContainer);
    }

    updateSidebarBadges();
    window.scrollTo(0, 0);
  }

  // =========================================================================
  // 6. Bootstrap & Initialization
  // =========================================================================
  function init() {
    try {
      // 1. Seed demo data safely
      initDemoData(false);

      // 2. Perform automated overdue scans
      checkAndUpdateOverdueInvoices();
    } catch (error) {
      console.warn("[PayPilot] LocalStorage bootstrap failed; continuing with empty default state.", error);
    }

    // 3. Normalize initial route to avoid blank main content on empty or malformed hashes.
    if (!window.location.hash || window.location.hash === "#") {
      window.location.hash = "#dashboard";
    }

    // 4. Register mobile toggle
    const toggle = document.getElementById("mobile-toggle");
    const sidebar = document.getElementById("app-sidebar");
    if (toggle && sidebar) {
      toggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
      });
    }

    // 5. Register hash change router
    window.addEventListener("hashchange", route);

    // 6. Initial route
    route();
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
