ALTER TABLE message_templates
  DROP CONSTRAINT IF EXISTS message_templates_type_check;

ALTER TABLE message_templates
  ADD CONSTRAINT message_templates_type_check
  CHECK (type IN ('birthday', 'anniversary', 'monthly_offer', 'follow_up', 'follow_up_female', 'follow_up_male'));

ALTER TABLE message_logs
  DROP CONSTRAINT IF EXISTS message_logs_type_check;

ALTER TABLE message_logs
  ADD CONSTRAINT message_logs_type_check
  CHECK (type IN ('birthday', 'anniversary', 'monthly_offer', 'follow_up', 'follow_up_female', 'follow_up_male', 'manual'));

INSERT INTO message_templates (type, name, content, is_active)
SELECT * FROM (VALUES
  ('follow_up_female'::VARCHAR, 'Female Follow Up (15 Days)'::VARCHAR, 'Hi {{name}}! We hope you are feeling great after your visit to {{salon_name}}. It has been 15 days since we saw you, and we would love to welcome you back soon.'::TEXT, TRUE),
  ('follow_up_male'::VARCHAR, 'Male Follow Up (75 Days)'::VARCHAR, 'Hi {{name}}! It has been some time since your last visit to {{salon_name}}. We would love to see you again. Book your next appointment whenever you are ready.'::TEXT, TRUE)
) AS v(type, name, content, is_active)
WHERE NOT EXISTS (
  SELECT 1
  FROM message_templates
  WHERE message_templates.type = v.type
);
