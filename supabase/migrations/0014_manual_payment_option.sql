-- Restore manual checkout with the same 1 USDT minimum. Existing quotes are immutable.
create or replace function public.create_paid_token_request(p_user_id uuid, p_id uuid, p_amount bigint, p_comment text, p_network text, p_expected_price_micros bigint, p_tx_hash text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_request public.token_requests; v_address text; v_price bigint; v_total bigint;
begin
  if length(p_tx_hash) > 128 then raise exception 'invalid transaction hash'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into v_request from public.token_requests where (id = p_id or status = 'pending') and user_id = p_user_id order by created_at desc limit 1;
  if found then return to_jsonb(v_request); end if;
  select address into v_address from public.token_payment_networks where id = p_network and active;
  if v_address is null then raise exception 'invalid payment network'; end if;
  select price_per_10000_micros into v_price from public.token_payment_settings where id = 1;
  if v_price is null or v_price is distinct from p_expected_price_micros then raise exception 'price changed'; end if;
  v_total := greatest(1000000, ceil(p_amount::numeric * v_price / 10000)::bigint);
  perform public.create_token_request(p_user_id, p_id, p_amount, p_comment);
  update public.token_requests set payment_network = p_network, payment_address = v_address,
    payment_amount_micros = v_total, payment_tx_hash = coalesce(trim(p_tx_hash), '')
  where id = p_id and user_id = p_user_id returning * into v_request;
  return to_jsonb(v_request);
end;
$$;
revoke all on function public.create_paid_token_request(uuid, uuid, bigint, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.create_paid_token_request(uuid, uuid, bigint, text, text, bigint, text) to service_role;
