-- Crypto Pay invoices and exactly-once crediting. Existing manual quotes remain intact.
alter table public.token_requests
  add column payment_provider text not null default 'manual' check (payment_provider in ('manual', 'crypto_pay')),
  add column crypto_invoice_id bigint unique,
  add column crypto_invoice_url text,
  add column crypto_expires_at timestamptz,
  add column crypto_paid_at timestamptz,
  add column crypto_fee_amount text,
  add column crypto_fee_asset text;

create function public.create_crypto_token_request(p_user_id uuid, p_id uuid, p_amount bigint, p_comment text, p_expected_price_micros bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.token_requests; price bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into r from public.token_requests where user_id = p_user_id and id = p_id;
  if found then return to_jsonb(r); end if;
  select * into r from public.token_requests where user_id = p_user_id and status = 'pending';
  if found then return to_jsonb(r); end if;
  select price_per_10000_micros into price from public.token_payment_settings where id = 1;
  if price is null or price is distinct from p_expected_price_micros then raise exception 'price changed'; end if;
  perform public.create_token_request(p_user_id, p_id, p_amount, p_comment);
  update public.token_requests set payment_provider = 'crypto_pay', payment_network = 'Crypto Bot',
    payment_amount_micros = greatest(1000000, ceil(p_amount::numeric * price / 10000)::bigint)
    where id = p_id returning * into r;
  return to_jsonb(r);
end;
$$;

-- Only the first saved invoice is exposed. A concurrent creator returns the saved one.
create function public.attach_crypto_invoice(p_id uuid, p_invoice_id bigint, p_url text, p_expires timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.token_requests;
begin
  select * into r from public.token_requests where id = p_id for update;
  if not found or r.payment_provider <> 'crypto_pay' then raise exception 'invalid request'; end if;
  if r.crypto_invoice_id is null and r.status = 'pending' then
    if p_invoice_id is null or p_invoice_id <= 0 or p_url is null or p_expires is null then raise exception 'invalid invoice'; end if;
    update public.token_requests set crypto_invoice_id = p_invoice_id, crypto_invoice_url = p_url, crypto_expires_at = p_expires
      where id = p_id returning * into r;
  end if;
  return to_jsonb(r);
end;
$$;

-- Blocks manual approval/rejection of automated invoices, including legacy admin buttons.
create function public.guard_crypto_decision() returns trigger language plpgsql set search_path = public as $$
begin
  if old.payment_provider = 'crypto_pay' and new.status in ('approved', 'rejected') and new.crypto_paid_at is null then
    raise exception 'Crypto Pay confirmation required';
  end if;
  return new;
end;
$$;
create trigger guard_crypto_decision before update on public.token_requests for each row execute function public.guard_crypto_decision();

create function public.settle_crypto_invoice(p_id uuid, p_invoice_id bigint, p_asset text, p_amount_micros bigint, p_paid_at timestamptz, p_fee_amount text default null, p_fee_asset text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.token_requests;
begin
  select * into r from public.token_requests where id = p_id for update;
  if not found or r.payment_provider <> 'crypto_pay' or r.crypto_invoice_id is distinct from p_invoice_id
    or p_invoice_id is null or p_asset is distinct from 'USDT' or r.payment_amount_micros is distinct from p_amount_micros
    or p_paid_at is null then raise exception 'invoice mismatch'; end if;
  if r.crypto_paid_at is not null then return to_jsonb(r); end if;
  -- A late verified payment still credits a cancelled request, once only.
  if r.status not in ('pending', 'cancelled') then raise exception 'invalid payment state'; end if;
  update public.user_accounts set token_balance = token_balance + r.amount, updated_at = now() where user_id = r.user_id;
  if not found then raise exception 'account not found'; end if;
  update public.token_requests set status = 'approved', credit_kind = 'purchase', decided_at = now(), decided_by = null,
    crypto_paid_at = p_paid_at, crypto_fee_amount = p_fee_amount, crypto_fee_asset = p_fee_asset,
    admin_note = 'Оплата подтверждена Crypto Bot. Токены начислены автоматически.', notified_at = null, notification_claimed_at = null
    where id = p_id returning * into r;
  return to_jsonb(r);
end;
$$;

create or replace function public.claim_token_notification(p_id uuid)
returns setof public.token_requests language sql security definer set search_path = public as $$
  update public.token_requests set notification_claimed_at = now()
  where id = p_id and ((payment_provider = 'manual' and status = 'pending') or (payment_provider = 'crypto_pay' and crypto_paid_at is not null))
    and notified_at is null and (notification_claimed_at is null or notification_claimed_at < now() - interval '2 minutes') returning *;
$$;

create or replace function public.dispatch_token_notifications()
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  if not exists (select 1 from public.token_requests where
    (payment_provider = 'manual' and status = 'pending' and notified_at is null)
    or (payment_provider = 'crypto_pay' and ((crypto_paid_at is not null and notified_at is null) or (status = 'pending' and crypto_invoice_id is not null)))) then return; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'token_notification_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'token_notification_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(url := v_url, headers := jsonb_build_object('Content-Type', 'application/json', 'x-telegram-bot-api-secret-token', v_secret), body := '{}'::jsonb, timeout_milliseconds := 120000);
end;
$$;

revoke all on function public.create_crypto_token_request(uuid, uuid, bigint, text, bigint) from public, anon, authenticated;
revoke all on function public.attach_crypto_invoice(uuid, bigint, text, timestamptz) from public, anon, authenticated;
revoke all on function public.settle_crypto_invoice(uuid, bigint, text, bigint, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.create_crypto_token_request(uuid, uuid, bigint, text, bigint) to service_role;
grant execute on function public.attach_crypto_invoice(uuid, bigint, text, timestamptz) to service_role;
grant execute on function public.settle_crypto_invoice(uuid, bigint, text, bigint, timestamptz, text, text) to service_role;

create or replace function public.token_admin_overview(p_status text default 'pending', p_search text default '', p_page integer default 0, p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  if p_status not in ('all', 'pending', 'approved', 'rejected', 'cancelled') or p_page < 0 or p_page > 100000 then raise exception 'invalid filter'; end if;
  select jsonb_build_object(
    'stats', jsonb_build_object(
      'users', (select count(*) from auth.users),
      'purchased', (select coalesce(sum(amount), 0) from public.token_requests where status = 'approved' and credit_kind = 'purchase'),
      'granted', (select coalesce(sum(amount), 0) from public.token_requests where status = 'approved' and credit_kind = 'grant'),
      'used', (select coalesce(sum(tokens_used), 0) from public.user_accounts),
      'balance', (select coalesce(sum(token_balance), 0) from public.user_accounts where not unlimited_tokens),
      'pending', (select count(*) from public.token_requests where status = 'pending'),
      'undelivered', (select count(*) from public.token_requests where notified_at is null and ((payment_provider = 'manual' and status = 'pending') or (payment_provider = 'crypto_pay' and crypto_paid_at is not null))),
      'projects', (select count(*) from public.projects)
    ),
    'total', (select count(*) from public.token_requests r join auth.users u on u.id = r.user_id
      where (p_status = 'all' or r.status = p_status) and (p_user_id is null or r.user_id = p_user_id)
      and (p_search = '' or position(lower(p_search) in lower(coalesce(u.email, '') || ' ' || r.id::text)) > 0)),
    'requests', coalesce((select jsonb_agg(to_jsonb(q)) from (
      select r.*, u.email, a.token_balance, a.tokens_used, a.unlimited_tokens,
        (select coalesce(sum(t.amount), 0) from public.token_requests t where t.user_id = r.user_id and t.status = 'approved' and t.credit_kind = 'purchase') as tokens_purchased,
        (select coalesce(sum(t.amount), 0) from public.token_requests t where t.user_id = r.user_id and t.status = 'approved' and t.credit_kind = 'grant') as tokens_granted
      from public.token_requests r join auth.users u on u.id = r.user_id left join public.user_accounts a on a.user_id = r.user_id
      where (p_status = 'all' or r.status = p_status) and (p_user_id is null or r.user_id = p_user_id)
        and (p_search = '' or position(lower(p_search) in lower(coalesce(u.email, '') || ' ' || r.id::text)) > 0)
      order by r.created_at desc, r.id desc limit 20 offset p_page * 20
    ) q), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
