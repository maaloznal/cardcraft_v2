-- The owner's test account has no token balance ceiling. The exception lives
-- in the database so a browser request cannot grant itself unlimited usage.
alter table public.user_accounts
  add column if not exists unlimited_tokens boolean not null default false;

-- Apply the exception to the existing account, or create its wallet if the
-- auth user predates the account table.
insert into public.user_accounts(user_id, token_balance, unlimited_tokens)
select id, 50000, true
from auth.users
where lower(email) = 'facebookbaga05@gmail.com'
on conflict (user_id) do update
set unlimited_tokens = true,
    updated_at = now();

-- Keep the exception when the owner account is created in a fresh project.
create or replace function public.handle_new_user_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_accounts(user_id, token_balance, unlimited_tokens)
  values (
    new.id,
    50000,
    lower(coalesce(new.email, '')) = 'facebookbaga05@gmail.com'
  )
  on conflict (user_id) do update
  set unlimited_tokens = public.user_accounts.unlimited_tokens or excluded.unlimited_tokens,
      updated_at = now();
  return new;
end;
$$;

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
  v_unlimited boolean;
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

  insert into public.user_accounts(user_id, token_balance, unlimited_tokens)
  select
    p_user_id,
    50000,
    lower(coalesce(email, '')) = 'facebookbaga05@gmail.com'
  from auth.users
  where id = p_user_id
  on conflict (user_id) do nothing;

  select token_balance, unlimited_tokens into v_balance, v_unlimited
  from public.user_accounts where user_id = p_user_id for update;
  if not found then
    raise exception 'account not found';
  end if;
  if not v_unlimited and v_balance < p_reserved_tokens then
    return jsonb_build_object('status', 'insufficient', 'balance', v_balance, 'unlimited', false);
  end if;

  if not v_unlimited then
    update public.user_accounts
    set token_balance = token_balance - p_reserved_tokens, updated_at = now()
    where user_id = p_user_id;
    v_balance := v_balance - p_reserved_tokens;
  end if;

  insert into public.ai_requests(request_id, user_id, status, reserved_tokens)
  values (p_request_id, p_user_id, 'pending', p_reserved_tokens);

  return jsonb_build_object(
    'status', 'accepted',
    'balance', v_balance,
    'unlimited', v_unlimited
  );
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
  v_unlimited boolean;
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

  select token_balance, unlimited_tokens into v_balance, v_unlimited
  from public.user_accounts where user_id = p_user_id for update;

  if v_unlimited then
    update public.user_accounts
    set tokens_used = tokens_used + p_consumed_tokens,
        updated_at = now()
    where user_id = p_user_id;
  else
    v_refund := greatest(v_reserved - p_consumed_tokens, 0);
    v_extra := greatest(p_consumed_tokens - v_reserved, 0);
    v_extra_charged := least(v_balance, v_extra);

    update public.user_accounts
    set token_balance = token_balance + v_refund - v_extra_charged,
        tokens_used = tokens_used + least(p_consumed_tokens, v_reserved + v_extra_charged),
        updated_at = now()
    where user_id = p_user_id;
    v_balance := v_balance + v_refund - v_extra_charged;
  end if;

  update public.ai_requests
  set status = 'completed', consumed_tokens = p_consumed_tokens, completed_at = now()
  where request_id = p_request_id;

  return jsonb_build_object(
    'status', 'completed',
    'balance', v_balance,
    'consumedTokens', p_consumed_tokens,
    'unlimited', v_unlimited
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
  v_unlimited boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select reserved_tokens into v_reserved
  from public.ai_requests
  where request_id = p_request_id and user_id = p_user_id and status = 'pending'
  for update;
  if not found then return jsonb_build_object('status', 'ignored'); end if;

  select token_balance, unlimited_tokens into v_balance, v_unlimited
  from public.user_accounts where user_id = p_user_id for update;
  if not v_unlimited then
    update public.user_accounts
    set token_balance = token_balance + v_reserved, updated_at = now()
    where user_id = p_user_id
    returning token_balance into v_balance;
  end if;

  update public.ai_requests
  set status = 'failed', completed_at = now()
  where request_id = p_request_id;
  return jsonb_build_object(
    'status', 'released',
    'balance', v_balance,
    'unlimited', v_unlimited
  );
end;
$$;

revoke all on function public.reserve_ai_request(uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.finalize_ai_request(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_ai_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(uuid, uuid, integer, integer) to service_role;
grant execute on function public.finalize_ai_request(uuid, uuid, integer) to service_role;
grant execute on function public.release_ai_request(uuid, uuid) to service_role;
