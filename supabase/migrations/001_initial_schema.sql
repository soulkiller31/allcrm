-- Salon CRM Database Schema
-- Copy ONLY the SQL below into Supabase → SQL Editor → New query → Run
-- Do NOT paste the file path or any markdown text

-- Tables
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  birthday DATE,
  anniversary DATE,
  last_visit DATE,
  gender VARCHAR(20),
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('birthday', 'anniversary', 'monthly_offer', 'follow_up', 'follow_up_female', 'follow_up_male')),
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('birthday', 'anniversary', 'monthly_offer', 'follow_up', 'follow_up_female', 'follow_up_male', 'manual')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_data JSONB,
  is_connected BOOLEAN DEFAULT FALSE,
  phone_number VARCHAR(20),
  last_connected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_birthday ON customers(birthday);
CREATE INDEX IF NOT EXISTS idx_customers_anniversary ON customers(anniversary);
CREATE INDEX IF NOT EXISTS idx_customers_last_visit ON customers(last_visit);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_type ON message_templates(type);
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON message_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_logs_customer ON message_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_logs_status ON message_logs(status);
CREATE INDEX IF NOT EXISTS idx_logs_sent_at ON message_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_logs_type ON message_logs(type);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_admins_updated_at ON admins;
CREATE TRIGGER update_admins_updated_at
  BEFORE UPDATE ON admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_templates_updated_at ON message_templates;
CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed data (skip if already exists)
INSERT INTO message_templates (type, name, content, is_active)
SELECT * FROM (VALUES
  ('birthday'::VARCHAR, 'Birthday Wishes'::VARCHAR, 'Happy Birthday {{name}}! Wishing you a wonderful day from {{salon_name}}. Visit us for a special birthday treat!'::TEXT, TRUE),
  ('anniversary', 'Anniversary Wishes', 'Happy Anniversary {{name}}! Celebrate your special day with us at {{salon_name}}. Book now for exclusive offers!', TRUE),
  ('monthly_offer', 'Monthly Offer', 'Hi {{name}}! {{salon_name}} has exciting offers this month. Visit us and pamper yourself!', TRUE),
  ('follow_up_female', 'Female Follow Up (15 Days)', 'Hi {{name}}! We hope you are feeling great after your visit to {{salon_name}}. It has been 15 days since we saw you, and we would love to welcome you back soon.', TRUE),
  ('follow_up_male', 'Male Follow Up (75 Days)', 'Hi {{name}}! It has been some time since your last visit to {{salon_name}}. We would love to see you again. Book your next appointment whenever you are ready.', TRUE),
  ('follow_up', 'General Follow Up', 'Hi {{name}}! It has been a while since your last visit to {{salon_name}}. We miss you! Book your appointment today.', TRUE)
) AS v(type, name, content, is_active)
WHERE NOT EXISTS (SELECT 1 FROM message_templates LIMIT 1);

INSERT INTO whatsapp_sessions (is_connected)
SELECT FALSE
WHERE NOT EXISTS (SELECT 1 FROM whatsapp_sessions LIMIT 1);

INSERT INTO app_settings (key, value)
SELECT * FROM (VALUES
  ('salon_name', '"Your Salon"'::JSONB),
  ('cron_enabled', 'true'::JSONB),
  ('birthday_cron', '"0 9 * * *"'::JSONB),
  ('anniversary_cron', '"0 9 * * *"'::JSONB),
  ('monthly_offer_cron', '"0 10 1 * *"'::JSONB),
  ('follow_up_cron', '"0 10 * * *"'::JSONB)
) AS v(key, value)
ON CONFLICT (key) DO NOTHING;

-- Row Level Security
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access admins" ON admins;
DROP POLICY IF EXISTS "Service role full access customers" ON customers;
DROP POLICY IF EXISTS "Service role full access templates" ON message_templates;
DROP POLICY IF EXISTS "Service role full access logs" ON message_logs;
DROP POLICY IF EXISTS "Service role full access whatsapp" ON whatsapp_sessions;
DROP POLICY IF EXISTS "Service role full access settings" ON app_settings;

CREATE POLICY "Service role full access admins" ON admins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access templates" ON message_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access logs" ON message_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access whatsapp" ON whatsapp_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access settings" ON app_settings FOR ALL USING (true) WITH CHECK (true);
