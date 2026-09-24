create table public.ai_requests (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now()
);

alter table public.ai_requests enable row level security;
create index ai_requests_user_created_idx on public.ai_requests(user_id, created_at desc);

create or replace function public.claim_ai_request(
  p_user_id uuid,
  p_request_id uuid,
  p_daily_limit integer
) returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if exists(select 1 from public.ai_requests where request_id = p_request_id) then
    return 'duplicate';
  end if;
  if (select count(*) from public.ai_requests where user_id = p_user_id and created_at >= now() - interval '24 hours') >= p_daily_limit then
    return 'limit';
  end if;
  insert into public.ai_requests(request_id, user_id) values (p_request_id, p_user_id);
  return 'accepted';
end;
$$;

revoke all on function public.claim_ai_request(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_ai_request(uuid, uuid, integer) to service_role;
