-- db/seed.sql — PayPilot v2 Demo Data
-- Run: node -e "require('./db/pool').seed()"

-- Only insert if clients table is empty
INSERT INTO clients (name, email, currency, country, trusted)
SELECT * FROM (VALUES
  ('Vanguard Tech Inc.', 'alice@vanguardtech.io', 'USD', 'United States', true),
  ('Nordic Design Studio Oy', 'marcus@nordicstudio.fi', 'EUR', 'Finland', true),
  ('Tokyo AI Robotics Labs', 'tanaka@tokyoailabs.jp', 'USD', 'Japan', false),
  ('Apex Growth Advisory', 'sophia@apexgrowth.co.uk', 'GBP', 'United Kingdom', true)
) AS v(name, email, currency, country, trusted)
WHERE NOT EXISTS (SELECT 1 FROM clients LIMIT 1);

-- Only insert if invoices table is empty
INSERT INTO invoices (invoice_number, client_id, amount, currency, status, due_date, issue_date, tax_rate, discount, line_items, notes)
SELECT * FROM (VALUES
  ('INV-2026-001', 1, 5850.00, 'USD', 'paid',
    (CURRENT_DATE - INTERVAL '10 days')::date,
    (CURRENT_DATE - INTERVAL '25 days')::date,
    0::numeric, 150.00::numeric,
    '[{"description":"Cross-Border Agent Architecture","qty":35,"price":120},{"description":"PayPal Webhook & Ledger Sync Setup","qty":15,"price":120}]'::jsonb,
    'Settled via PayPal Sandbox checkout.'),
  ('INV-2026-002', 2, 4730.00, 'EUR', 'sent',
    (CURRENT_DATE + INTERVAL '5 days')::date,
    (CURRENT_DATE - INTERVAL '12 days')::date,
    0.10::numeric, 0::numeric,
    '[{"description":"FinTech Design Sprint & UX Tokens","qty":1,"price":3200},{"description":"Mobile Responsive Component Library","qty":1,"price":1100}]'::jsonb,
    'Payment due within 14 days of issue.'),
  ('INV-2026-003', 3, 4200.00, 'USD', 'pending_approval',
    (CURRENT_DATE + INTERVAL '15 days')::date,
    (CURRENT_DATE - INTERVAL '3 days')::date,
    0::numeric, 0::numeric,
    '[{"description":"Autonomous AI Cash-Flow Modeling Module","qty":1,"price":4200}]'::jsonb,
    'First engagement for Tokyo AI Labs. Guard held for policy review.'),
  ('INV-2026-004', 4, 2640.00, 'GBP', 'overdue',
    (CURRENT_DATE - INTERVAL '12 days')::date,
    (CURRENT_DATE - INTERVAL '32 days')::date,
    0.20::numeric, 0::numeric,
    '[{"description":"AI Agent Prompt Engineering & System Safety","qty":20,"price":110}]'::jsonb,
    'Payment is overdue. Automated chaser generated.'),
  ('INV-2026-005', 1, 1500.00, 'USD', 'draft',
    (CURRENT_DATE + INTERVAL '20 days')::date,
    (CURRENT_DATE - INTERVAL '1 day')::date,
    0::numeric, 0::numeric,
    '[{"description":"Next.js App Router Integration","qty":12,"price":125}]'::jsonb,
    'Draft invoice for upcoming sprint deliverables.')
) AS v(invoice_number, client_id, amount, currency, status, due_date, issue_date, tax_rate, discount, line_items, notes)
WHERE NOT EXISTS (SELECT 1 FROM invoices LIMIT 1);
