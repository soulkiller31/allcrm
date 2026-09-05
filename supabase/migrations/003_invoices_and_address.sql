-- Add address to customers + invoices table
-- Run in Supabase SQL Editor after 001 and 002 migrations

ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number SERIAL UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(255),
  customer_address TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  whatsapp_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access invoices" ON invoices;
CREATE POLICY "Service role full access invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);

INSERT INTO app_settings (key, value)
VALUES ('salon_address', '"Your Salon Address"'::JSONB)
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value)
VALUES ('salon_phone', '"+91 0000000000"'::JSONB)
ON CONFLICT (key) DO NOTHING;
