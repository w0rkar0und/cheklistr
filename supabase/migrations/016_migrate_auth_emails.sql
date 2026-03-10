-- ============================================================
-- Migration 016: Migrate Auth Emails to Multi-Tenant Format
-- ============================================================
-- The frontend now sends {loginId}.{orgSlug}@cheklistr.app to
-- Supabase Auth signInWithPassword. Existing auth records still
-- use the old format {loginId}@cheklistr.app.
--
-- This migration updates auth.users emails to the new format
-- for all existing users (all currently belong to Greythorn).
--
-- Old format: x123456@cheklistr.app
-- New format: x123456.greythorn@cheklistr.app
--
-- REQUIRES: Migrations 012a/b applied (organisations table exists).
-- ============================================================

UPDATE auth.users
SET
  email = REPLACE(email, '@cheklistr.app', '.greythorn@cheklistr.app'),
  updated_at = now()
WHERE email LIKE '%@cheklistr.app'
  AND email NOT LIKE '%.greythorn@cheklistr.app';
