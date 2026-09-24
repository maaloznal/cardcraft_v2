-- Migration 0002: Add version column to projects
--
-- Background: cloudSync.ts (pushProject) writes `version` field, but the
-- projects table created by 0001 migration is missing this column.
-- Result: cloud sync was failing with `column "version" does not exist`.
--
-- This migration adds the column with safe defaults for existing rows.

-- Add version column (NOT NULL, default 1, backfills existing rows automatically)
alter table public.projects
  add column if not exists version int not null default 1;

-- Helpful index for ordering by update time + version (optional, but matches 0001 style)
-- (Already created projects_updated_at_idx in 0001 — no new index needed here.)
