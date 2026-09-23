-- Migration 0003: Enable Realtime for projects table
--
-- Adds the projects table to the supabase_realtime publication so that
-- INSERT/UPDATE/DELETE events on projects are broadcast via WebSocket
-- to subscribed clients. RLS policies on projects ensure users only
-- receive events for their own rows.

ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
