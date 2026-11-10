-- db/schema.sql — PayPilot v2 Postgres Schema
-- Run once: node -e "require('./db/pool').initSchema()"

CREATE TABLE IF NOT EXISTS clients (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  currency      VARCHAR(10) NOT NULL DEFAULT 'USD',
  country       VARCHAR(100),
  trusted       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id                SERIAL PRIMARY KEY,
  invoice_number    VARCHAR(50) NOT NULL,
  client_id         INTEGER NOT NULL REFERENCES clients(id),
  amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency          VARCHAR(10) NOT NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'draft',
  due_date          DATE NOT NULL,
  issue_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  tax_rate          NUMERIC(5,4) DEFAULT 0,
  discount          NUMERIC(12,2) DEFAULT 0,
  line_items        JSONB NOT NULL DEFAULT '[]',
  notes             TEXT,
  paypal_invoice_id VARCHAR(255),
  idempotency_key   VARCHAR(255) UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id            SERIAL PRIMARY KEY,
  invoice_id    INTEGER REFERENCES invoices(id),
  type          VARCHAR(100) NOT NULL,
  external_id   VARCHAR(255) UNIQUE,
  payload       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposed_actions (
  id              SERIAL PRIMARY KEY,
  event_id        INTEGER REFERENCES events(id),
  invoice_id      INTEGER NOT NULL REFERENCES invoices(id),
  action_type     VARCHAR(100) NOT NULL,
  params          JSONB NOT NULL DEFAULT '{}',
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  idempotency_key VARCHAR(255) UNIQUE,
  reasoning       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  id                  SERIAL PRIMARY KEY,
  proposed_action_id  INTEGER REFERENCES proposed_actions(id),
  decision            VARCHAR(20) NOT NULL,
  reason              TEXT,
  policy_snapshot     JSONB,
  actor               VARCHAR(100) DEFAULT 'guard',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_external_id ON events(external_id);
CREATE INDEX IF NOT EXISTS idx_proposed_actions_status ON proposed_actions(status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
