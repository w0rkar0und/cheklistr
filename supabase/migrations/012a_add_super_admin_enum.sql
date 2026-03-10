-- ============================================================
-- Migration 012a: Add super_admin to user_role enum
-- ============================================================
-- PostgreSQL requires new enum values to be committed in a
-- separate transaction before they can be referenced.
-- Run this FIRST, then run 012b immediately after.
-- ============================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
