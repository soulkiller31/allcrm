-- Remaining pieces if 004 was only partly applied. Safe to re-run.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS gstin VARCHAR(20);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS gstin VARCHAR(20);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cashfree_order_id VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(30) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  cashfree_payment_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access payments" ON payments;
CREATE POLICY "Service role full access payments" ON payments FOR ALL USING (true) WITH CHECK (true);

-- Attach existing unscoped rows to the first tenant
UPDATE customers SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE invoices SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE admins SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE message_templates SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE message_logs SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE whatsapp_sessions SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE app_settings SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
