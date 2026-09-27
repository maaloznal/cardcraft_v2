-- Per-user AI token wallet. The browser has read-only access; all balance
-- changes happen through service-role-only functions called by the Edge Function.
create table if not exists public.user_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_balance bigint not null default 50000 check (token_balance >= 0),
  tokens_used bigint not null default 0 check (tokens_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_accounts enable row level security;

drop policy if exists "own account select" on public.user_accounts;
create policy "own account select"
on public.user_accounts for select
using (auth.uid() = user_id);

create or replace function public.handle_new_user_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_accounts(user_id, token_balance)
  values (new.id, 50000)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_account on auth.users;
create trigger on_auth_user_created_account
after insert on auth.users
for each row execute function public.handle_new_user_account();

-- Existing registered users receive the same launch allowance once.
insert into public.user_accounts(user_id, token_balance)
select id, 50000 from auth.users
on conflict (user_id) do nothing;

alter table public.ai_requests
  add column if not exists reserved_tokens integer not null default 0,
  add column if not exists consumed_tokens integer,
  add column if not exists completed_at timestamptz;

alter table public.ai_requests drop constraint if exists ai_requests_status_check;
alter table public.ai_requests
  add constraint ai_requests_status_check check (status in ('pending', 'completed', 'failed'));

drop policy if exists "own ai requests select" on public.ai_requests;
create policy "own ai requests select"
on public.ai_requests for select
using (auth.uid() = user_id);

create or replace function public.reserve_ai_request(
  p_user_id uuid,
  p_request_id uuid,
  p_daily_limit integer,
  p_reserved_tokens integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  if p_reserved_tokens < 1 or p_reserved_tokens > 30000 then
    raise exception 'invalid token reservation';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if exists(select 1 from public.ai_requests where request_id = p_request_id) then
    return jsonb_build_object('status', 'duplicate');
  end if;
  if (select count(*) from public.ai_requests
      where user_id = p_user_id
        and status in ('pending', 'completed')
        and created_at >= now() - interval '24 hours') >= p_daily_limit then
    return jsonb_build_object('status', 'limit');
  end if;

  insert into public.user_accounts(user_id, token_balance)
  values (p_user_id, 50000)
  on conflict (user_id) do nothing;

  select token_balance into v_balance
  from public.user_accounts where user_id = p_user_id for update;
  if v_balance < p_reserved_tokens then
    return jsonb_build_object('status', 'insufficient', 'balance', v_balance);
  end if;

  update public.user_accounts
  set token_balance = token_balance - p_reserved_tokens, updated_at = now()
  where user_id = p_user_id;
  insert into public.ai_requests(request_id, user_id, status, reserved_tokens)
  values (p_request_id, p_user_id, 'pending', p_reserved_tokens);

  return jsonb_build_object('status', 'accepted', 'balance', v_balance - p_reserved_tokens);
end;
$$;

create or replace function public.finalize_ai_request(
  p_user_id uuid,
  p_request_id uuid,
  p_consumed_tokens integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserved integer;
  v_balance bigint;
  v_extra bigint;
  v_extra_charged bigint;
  v_refund bigint;
begin
  if p_consumed_tokens < 0 then raise exception 'invalid token usage'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select reserved_tokens into v_reserved
  from public.ai_requests
  where request_id = p_request_id and user_id = p_user_id and status = 'pending'
  for update;
  if not found then return jsonb_build_object('status', 'ignored'); end if;

  select token_balance into v_balance
  from public.user_accounts where user_id = p_user_id for update;
  v_refund := greatest(v_reserved - p_consumed_tokens, 0);
  v_extra := greatest(p_consumed_tokens - v_reserved, 0);
  v_extra_charged := least(v_balance, v_extra);

  update public.user_accounts
  set token_balance = token_balance + v_refund - v_extra_charged,
      tokens_used = tokens_used + least(p_consumed_tokens, v_reserved + v_extra_charged),
      updated_at = now()
  where user_id = p_user_id;
  update public.ai_requests
  set status = 'completed', consumed_tokens = p_consumed_tokens, completed_at = now()
  where request_id = p_request_id;

  return jsonb_build_object(
    'status', 'completed',
    'balance', v_balance + v_refund - v_extra_charged,
    'consumedTokens', p_consumed_tokens
  );
end;
$$;

create or replace function public.release_ai_request(
  p_user_id uuid,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserved integer;
  v_balance bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select reserved_tokens into v_reserved
  from public.ai_requests
  where request_id = p_request_id and user_id = p_user_id and status = 'pending'
  for update;
  if not found then return jsonb_build_object('status', 'ignored'); end if;

  update public.user_accounts
  set token_balance = token_balance + v_reserved, updated_at = now()
  where user_id = p_user_id
  returning token_balance into v_balance;
  update public.ai_requests
  set status = 'failed', completed_at = now()
  where request_id = p_request_id;
  return jsonb_build_object('status', 'released', 'balance', v_balance);
end;
$$;

revoke all on function public.reserve_ai_request(uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.finalize_ai_request(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_ai_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(uuid, uuid, integer, integer) to service_role;
grant execute on function public.finalize_ai_request(uuid, uuid, integer) to service_role;
grant execute on function public.release_ai_request(uuid, uuid) to service_role;

