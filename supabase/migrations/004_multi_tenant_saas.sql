-- Multi-tenant SaaS: tenants, subscriptions, payments, services, tenant_id isolation

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  business_type VARCHAR(50) DEFAULT 'general',
  owner_email VARCHAR(255) UNIQUE NOT NULL,
  owner_name VARCHAR(255) DEFAULT '',
  phone VARCHAR(20),
  address TEXT,
  gstin VARCHAR(20),
  logo_url TEXT,
  supabase_user_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS gstin VARCHAR(20);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan VARCHAR(30) NOT NULL DEFAULT 'trial',
  status VARCHAR(30) NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  paid_from TIMESTAMPTZ,
  paid_until TIMESTAMPTZ,
  cashfree_order_id VARCHAR(100),
  cashfree_payment_id VARCHAR(100),
  amount_paid DECIMAL(12, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cashfree_order_id VARCHAR(100) UNIQUE NOT NULL,
  cashfree_payment_id VARCHAR(100),
  plan VARCHAR(30) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default tenant for existing Cut n Culture rows
INSERT INTO tenants (name, business_type, owner_email, owner_name, phone, address, gstin, is_active)
SELECT
  'Cut n Culture',
  'salon',
  COALESCE((SELECT email FROM admins ORDER BY created_at LIMIT 1), 'admin@salon.com'),
  COALESCE((SELECT name FROM admins ORDER BY created_at LIMIT 1), 'Salon Admin'),
  '9358830044',
  'Plot no. 20 Next Step Physio Opposite The Valencia building moti nagar akshardham mandir road, Chitrkoot, Vaishali Nagar, Jaipur, Rajasthan 302021',
  NULL,
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM tenants LIMIT 1);

-- Columns
ALTER TABLE admins ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS gstin VARCHAR(20);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Backfill existing rows onto the first tenant
UPDATE admins SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE customers SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE invoices SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE message_templates SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE message_logs SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE whatsapp_sessions SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE app_settings SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;

-- Trial for default tenant if none
INSERT INTO subscriptions (tenant_id, plan, status, trial_ends_at)
SELECT id, 'trial', 'trial', NOW() + INTERVAL '3 days'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.tenant_id = t.id);

-- Invoice numbers unique per tenant, not globally
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_tenant_number_idx ON invoices (tenant_id, invoice_number);

-- Phone unique per tenant
CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_phone_idx ON customers (tenant_id, phone);

-- app_settings: allow same key per tenant
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE app_settings SET id = gen_random_uuid() WHERE id IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_pkey'
  ) THEN
    ALTER TABLE app_settings ADD PRIMARY KEY (id);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_tenant_key_idx ON app_settings (tenant_id, key);

CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_templates_tenant ON message_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_logs_tenant ON message_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admins_tenant ON admins(tenant_id);

DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access tenants" ON tenants;
DROP POLICY IF EXISTS "Service role full access subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service role full access payments" ON payments;
DROP POLICY IF EXISTS "Service role full access services" ON services;

CREATE POLICY "Service role full access tenants" ON tenants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access subscriptions" ON subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access payments" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access services" ON services FOR ALL USING (true) WITH CHECK (true);

-- Allow invoice type on message logs
ALTER TABLE message_logs DROP CONSTRAINT IF EXISTS message_logs_type_check;
ALTER TABLE message_logs
  ADD CONSTRAINT message_logs_type_check
  CHECK (type IN ('birthday', 'anniversary', 'monthly_offer', 'follow_up', 'follow_up_female', 'follow_up_male', 'manual', 'invoice'));
