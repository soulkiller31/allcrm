-- Migration 006: Add firebase_uid columns to tenants and admins for Firebase Auth integration
-- Idempotent: safe to re-run multiple times

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255);
ALTER TABLE admins  ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_firebase_uid ON tenants(firebase_uid)
  WHERE firebase_uid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_firebase_uid  ON admins(firebase_uid)
  WHERE firebase_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
