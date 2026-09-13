-- Create projects table for cloud sync
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.projects enable row level security;

-- Create RLS policies
-- Users can only select their own projects
create policy "own projects select"
on public.projects for select
using (auth.uid() = user_id);

-- Users can only insert their own projects
create policy "own projects insert"
on public.projects for insert
with check (auth.uid() = user_id);

-- Users can only update their own projects
create policy "own projects update"
on public.projects for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Users can only delete their own projects
create policy "own projects delete"
on public.projects for delete
using (auth.uid() = user_id);

-- Create index on user_id for faster queries
create index projects_user_id_idx on public.projects(user_id);

-- Create index on updated_at for sorting
create index projects_updated_at_idx on public.projects(updated_at desc);
