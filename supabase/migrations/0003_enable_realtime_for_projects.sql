-- Migration 0003: Enable Realtime for projects table
--
-- Adds the projects table to the supabase_realtime publication so that
-- INSERT/UPDATE/DELETE events on projects are broadcast via WebSocket
-- to subscribed clients. RLS policies on projects ensure users only
-- receive events for their own rows.
--
-- Idempotent: uses a DO block to check if projects is already in the
-- publication before adding it. Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
  END IF;
END
$$;
