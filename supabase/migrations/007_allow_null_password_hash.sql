-- Migration 007: Allow NULL password_hash for Firebase-only users
-- Firebase users authenticate via Google/Firebase and have no CRM password.
-- They can optionally set one later via Settings → Security.

ALTER TABLE admins ALTER COLUMN password_hash DROP NOT NULL;
