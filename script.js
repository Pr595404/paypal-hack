// script.js – simple static frontend prototype for PayPilot
// Uses Tailwind CSS from CDN and LocalStorage for persistence.

// ==== Data models stored in localStorage ==== //
const LS_KEY = {
  clients: "paypilot_clients",
  invoices: "paypilot_invoices",
  proposed: "paypilot_proposed_actions",
};

function load(key) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}
function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Seed demo data if empty
function initDemoData() {
  // Initialize demo data only if not present
  if (!localStorage.getItem(LS.clients)) {
    const demoClients = [
      {
        id: 1,
        name: "Alice Freelancer",
        email: "alice@example.com",
        currency: "USD",
        trusted: true,
      },
      {
        id: 2,
        name: "Bob Remote",
        email: "bob@example.com",
        currency: "EUR",
        trusted: false,
      },
    ];
    save(LS.clients, demoClients);
  }

  if (!localStorage.getItem(LS.invoices)) {
    const demoInvoices = [
      {
        id: 1,
        clientId: 1,
        lineItems: [
          { description: "Design work", qty: 10, price: 50 },
          { description: "Consulting", qty: 5, price: 80 },
        ],
        taxRate: 0.1,
        discount: 0,
        status: "sent",
        createdAt: new Date().toISOString(),
        dueDate: new Date(Date.now() + 7 * 86400000)
          .toISOString()
          .split("T")[0],
      },
    ];
    save(LS.invoices, demoInvoices);
  }

  if (!localStorage.getItem(LS.approvals)) {
    const demoApprovals = [
      {
        id: 1,
        invoiceId: 1,
        type: "send_invoice",
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    ];
    save(LS.approvals, demoApprovals);
  }

  if (!localStorage.getItem(LS.reminders)) {
    save(LS.reminders, []);
  }

  if (!localStorage.getItem(LS.settings)) {
    save(LS.settings, { demoMode: true });
  }
}
  if (!localStorage.getItem(LS_KEY.clients).length) {
    const demoClients = [
      {
        id: 1,
        name: "Alice Freelancer",
        email: "alice@example.com",
        currency: "USD",
        trusted: true,
      },
      {
        id: 2,
        name: "Bob Remote",
        email: "bob@example.com",
        currency: "EUR",
        trusted: false,
      },
    ];
    save(LS_KEY.clients, demoClients);
  }
  if (!localStorage.getItem(LS_KEY.invoices)) {
    const demoInvoices = [];
    save(LS_KEY.invoices, demoInvoices);
  }
  if (!localStorage.getItem(LS_KEY.proposed)) {
    save(LS_KEY.proposed, []);
  }
}

// Simple hash‑router
window.addEventListener("hashchange", render);
window.addEventListener("load", () => {
  initDemoData();
  render();
});

function render() {
  const hash = location.hash || "#dashboard";
  const app = document.getElementById("app");
  app.innerHTML = ""; // clear
  if (hash.startsWith("#dashboard")) renderDashboard(app);
  else if (hash.startsWith("#new")) renderNewInvoice(app);
  else if (hash.startsWith("#approvals")) renderApprovals(app);
  else app.innerHTML = `<p class=\"text-center\">Page not found.</p>`;
}

// ----- Dashboard ----- //
function renderDashboard(container) {
  const invoices = load(LS_KEY.invoices);
  container.innerHTML = `
    <h2 class=\"text-xl font-semibold mb-4\">Dashboard – Invoices</h2>
    <table class=\"min-w-full bg-white shadow rounded\">
      <thead class=\"bg-gray-100\">
        <tr>
          <th class=\"p-2 text-left\">#</th>
          <th class=\"p-2 text-left\">Client</th>
          <th class=\"p-2 text-left\">Amount</th>
          <th class=\"p-2 text-left\">Currency</th>
          <th class=\"p-2 text-left\">Status</th>
        </tr>
      </thead>
      <tbody id=\"invoice-body\"></tbody>
    </table>
  `;
  const tbody = container.querySelector("#invoice-body");
  if (invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan=5 class=\"p-2 text-center\">No invoices yet.</td></tr>`;
    return;
  }
  const clients = load(LS_KEY.clients);
  invoices.forEach((inv) => {
    const client = clients.find((c) => c.id === inv.clientId) || { name: "?" };
    const row = document.createElement("tr");
    row.className = "border-b";
    row.innerHTML = `
      <td class=\"p-2\">${inv.id}</td>
      <td class=\"p-2\">${client.name}</td>
      <td class=\"p-2\">${inv.amount}</td>
      <td class=\"p-2\">${inv.currency}</td>
      <td class=\"p-2 capitalize\">${inv.status}</td>
    `;
    tbody.appendChild(row);
  });
}

// ----- New Invoice Form ----- //
function renderNewInvoice(container) {
  const clients = load(LS_KEY.clients);
  const clientOptions = clients
    .map((c) => `<option value="${c.id}">${c.name} (${c.currency})</option>`)
    .join("");

  container.innerHTML = `
    <h2 class=\"text-xl font-semibold mb-4\">Create New Invoice</h2>
    <form id=\"invoice-form\" class=\"max-w-md space-y-4\">
      <div>
        <label class=\"block font-medium\">Client</label>
        <select name="clientId" class=\"w-full border rounded p-2\" required>
          ${clientOptions}
        </select>
      </div>
      <div>
        <label class=\"block font-medium\">Amount</label>
        <input type="number" name="amount" step="0.01" min="0" class=\"w-full border rounded p-2\" required />
      </div>
      <div>
        <label class=\"block font-medium\">Due Date</label>
        <input type="date" name="dueDate" class=\"w-full border rounded p-2\" required />
      </div>
      <button type="submit" class=\"px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700\">Create Invoice</button>
    </form>
    <p id=\"msg\" class=\"mt-4 text-green-600\"></p>
  `;

  const form = container.querySelector("#invoice-form");
  const msg = container.querySelector("#msg");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const clientId = Number(data.get("clientId"));
    const amount = parseFloat(data.get("amount"));
    const dueDate = data.get("dueDate");

    const invoices = load(LS_KEY.invoices);
    const newId = invoices.length ? invoices[invoices.length - 1].id + 1 : 1;
    const newInv = {
      id: newId,
      clientId,
      amount,
      currency: clients.find((c) => c.id === clientId).currency,
      status: "draft",
      dueDate,
    };
    invoices.push(newInv);
    save(LS_KEY.invoices, invoices);

    // create a pending proposed action for sending the invoice
    const proposed = load(LS_KEY.proposed);
    proposed.push({
      id: proposed.length ? proposed[proposed.length - 1].id + 1 : 1,
      invoiceId: newId,
      type: "send_invoice",
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    save(LS_KEY.proposed, proposed);

    msg.textContent = "Invoice created and pending approval.";
    form.reset();
  });
}

// ----- Approvals ----- //
function renderApprovals(container) {
  const proposed = load(LS_KEY.proposed).filter((p) => p.status === "pending");
  const invoices = load(LS_KEY.invoices);
  const clients = load(LS_KEY.clients);

  container.innerHTML = `
    <h2 class=\"text-xl font-semibold mb-4\">Pending Approvals</h2>
    <ul id=\"approval-list\" class=\"space-y-2\"></ul>
    <p id=\"no-msg\" class=\"text-gray-500\"></p>
  `;
  const list = container.querySelector("#approval-list");
  const noMsg = container.querySelector("#no-msg");

  if (proposed.length === 0) {
    noMsg.textContent = "No pending actions.";
    return;
  }

  proposed.forEach((act) => {
    const inv = invoices.find((i) => i.id === act.invoiceId);
    const client = clients.find((c) => c.id === inv.clientId);
    const li = document.createElement("li");
    li.className = "p-4 border rounded bg-white shadow-sm";
    li.innerHTML = `
      <div class=\"flex justify-between items-center\">
        <div>
          <strong>Invoice #${inv.id}</strong> for <em>${client.name}</em> – $${inv.amount} ${inv.currency}
        </div>
        <div class=\"space-x-2\">
          <button data-id="${act.id}" class=\"approve btn bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700\">Approve</button>
          <button data-id="${act.id}" class=\"reject btn bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700\">Reject</button>
        </div>
      </div>
    `;
    list.appendChild(li);
  });

  // event delegation for approve/reject
  list.addEventListener("click", (e) => {
    const target = e.target;
    if (!target.matches("button")) return;
    const id = Number(target.dataset.id);
    const action = load(LS_KEY.proposed).find((a) => a.id === id);
    if (!action) return;
    const allProposed = load(LS_KEY.proposed);
    const index = allProposed.findIndex((a) => a.id === id);
    if (target.classList.contains("approve")) {
      action.status = "approved";
      // Simulate guard: mark the invoice as sent
      const allInvoices = load(LS_KEY.invoices);
      const invIdx = allInvoices.findIndex((i) => i.id === action.invoiceId);
      if (invIdx !== -1) allInvoices[invIdx].status = "sent";
      save(LS_KEY.invoices, allInvoices);
    } else if (target.classList.contains("reject")) {
      action.status = "rejected";
    }
    allProposed[index] = action;
    save(LS_KEY.proposed, allProposed);
    render(); // refresh approvals view
  });
}

// Utility CSS class for buttons (Tailwind already provides, but keep for readability)
