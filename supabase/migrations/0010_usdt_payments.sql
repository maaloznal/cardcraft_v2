-- Public payment instructions, never custody keys. Request keeps an immutable quote.
create table public.token_payment_settings (
  id integer primary key check (id = 1),
  price_per_10000_micros bigint check (price_per_10000_micros between 1 and 1000000000)
);
insert into public.token_payment_settings(id, price_per_10000_micros) values (1, 100000);
create table public.token_payment_networks (
  id text primary key,
  label text not null,
  address text not null,
  position integer not null,
  active boolean not null default true
);
insert into public.token_payment_networks(id, label, address, position) values
  ('ton', 'TON', 'UQBzPAy9__EmZJ12U4FHwYRi-Yh-o--6-o6_Otv5ZzQ9pfhm', 1),
  ('tron', 'Tron (TRC20)', 'TVY6SunRqpGwmnrmcm8Fm9o8eQG8kGiDS9', 2),
  ('solana', 'Solana', '6nWvcFDKAqToabEEFkcUbhjD8sBx1AsuNswtjEjwADM5', 3),
  ('ethereum', 'Ethereum (ERC20)', '0x651182c6E367122d098739f7E6741DAA1490d505', 4),
  ('bsc', 'BNB Smart Chain (BEP20)', '0x651182c6E367122d098739f7E6741DAA1490d505', 5);
alter table public.token_payment_settings enable row level security;
alter table public.token_payment_networks enable row level security;
revoke all on public.token_payment_settings, public.token_payment_networks from anon, authenticated;
grant select on public.token_payment_settings, public.token_payment_networks to authenticated;
grant all on public.token_payment_settings, public.token_payment_networks to service_role;
create policy "read payment settings" on public.token_payment_settings for select to authenticated using (true);
create policy "read active payment networks" on public.token_payment_networks for select to authenticated using (active);

alter table public.token_requests
  add column payment_network text,
  add column payment_address text,
  add column payment_amount_micros bigint,
  add column payment_tx_hash text not null default '' check (length(payment_tx_hash) <= 128),
  add column payment_updates integer not null default 0;

create function public.create_paid_token_request(p_user_id uuid, p_id uuid, p_amount bigint, p_comment text, p_network text, p_expected_price_micros bigint, p_tx_hash text default '')
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
  if v_price is distinct from p_expected_price_micros then raise exception 'price changed'; end if;
  v_total := case when v_price is null then null else ceil(p_amount::numeric * v_price / 10000)::bigint end;
  perform public.create_token_request(p_user_id, p_id, p_amount, p_comment);
  update public.token_requests set payment_network = p_network, payment_address = v_address,
    payment_amount_micros = v_total, payment_tx_hash = coalesce(trim(p_tx_hash), '')
  where id = p_id and user_id = p_user_id returning * into v_request;
  return to_jsonb(v_request);
end;
$$;
revoke all on function public.create_paid_token_request(uuid, uuid, bigint, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.create_paid_token_request(uuid, uuid, bigint, text, text, bigint, text) to service_role;

create function public.set_token_payment_hash(p_user_id uuid, p_id uuid, p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_request public.token_requests;
begin
  if p_hash is null or length(trim(p_hash)) < 8 or length(trim(p_hash)) > 128 then raise exception 'invalid transaction hash'; end if;
  select * into v_request from public.token_requests where id = p_id and user_id = p_user_id for update;
  if not found or v_request.status <> 'pending' then raise exception 'request not pending'; end if;
  if v_request.payment_tx_hash = trim(p_hash) then return to_jsonb(v_request); end if;
  if v_request.payment_updates >= 3 then raise exception 'payment update limit'; end if;
  update public.token_requests set payment_tx_hash = trim(p_hash), payment_updates = payment_updates + 1,
    notified_at = null, notification_claimed_at = null
  where id = p_id returning * into v_request;
  return to_jsonb(v_request);
end;
$$;
revoke all on function public.set_token_payment_hash(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_token_payment_hash(uuid, uuid, text) to service_role;
