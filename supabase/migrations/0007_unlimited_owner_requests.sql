-- Unlimited test accounts must not be blocked by the daily request guard.
-- The flag remains server-controlled and is never accepted from the client.
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

  -- Do not read auth.users in the request path. The auth trigger owns the
  -- server-side unlimited flag; this fallback only creates a regular wallet.
  insert into public.user_accounts(user_id, token_balance)
  values (p_user_id, 50000)
  on conflict (user_id) do nothing;

  select token_balance, unlimited_tokens into v_balance, v_unlimited
  from public.user_accounts where user_id = p_user_id for update;
  if not found then
    raise exception 'account not found';
  end if;

  if not v_unlimited and (select count(*) from public.ai_requests
      where user_id = p_user_id
        and status in ('pending', 'completed')
        and created_at >= now() - interval '24 hours') >= p_daily_limit then
    return jsonb_build_object('status', 'limit');
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

revoke all on function public.reserve_ai_request(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(uuid, uuid, integer, integer) to service_role;
