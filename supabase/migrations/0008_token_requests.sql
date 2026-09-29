-- The client can only read its own requests. Creation and decisions are server-only.
create table public.token_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount between 10000 and 1000000000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  credit_kind text check (credit_kind in ('purchase', 'grant')),
  comment text not null default '' check (length(comment) <= 500),
  admin_note text not null default '' check (length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by bigint,
  notified_at timestamptz,
  notification_claimed_at timestamptz,
  telegram_message_id bigint
);
create unique index token_requests_one_pending on public.token_requests(user_id) where status = 'pending';
create index token_requests_history on public.token_requests(user_id, created_at desc);
create index token_requests_queue on public.token_requests(status, created_at desc);
alter table public.token_requests enable row level security;
revoke all on public.token_requests from anon, authenticated;
grant select on public.token_requests to authenticated;
grant all on public.token_requests to service_role;
create policy "own token requests" on public.token_requests for select to authenticated using (user_id = auth.uid());

create function public.create_token_request(p_user_id uuid, p_id uuid, p_amount bigint, p_comment text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_request public.token_requests;
begin
  if p_amount is null or p_amount < 10000 or p_amount > 1000000000 or length(p_comment) > 500 then
    raise exception 'invalid request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into v_request from public.token_requests where id = p_id and user_id = p_user_id;
  if found then return to_jsonb(v_request); end if;
  select * into v_request from public.token_requests where user_id = p_user_id and status = 'pending';
  if found then return to_jsonb(v_request); end if;
  if (select count(*) from public.token_requests where user_id = p_user_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'request rate limit';
  end if;
  insert into public.token_requests(id, user_id, amount, comment)
  values (p_id, p_user_id, p_amount, coalesce(p_comment, '')) returning * into v_request;
  return to_jsonb(v_request);
end;
$$;

-- Row lock makes competing approve/reject and retries exactly-once for the wallet.
create function public.decide_token_request(p_id uuid, p_decision text, p_admin_id bigint, p_kind text default 'purchase', p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_request public.token_requests;
begin
  if p_admin_id is distinct from 7145160476::bigint then raise exception 'forbidden'; end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') or p_kind is null or p_kind not in ('purchase', 'grant') or length(p_note) > 500 then
    raise exception 'invalid decision';
  end if;
  select * into v_request from public.token_requests where id = p_id for update;
  if not found then raise exception 'request not found'; end if;
  if v_request.status <> 'pending' then return jsonb_build_object('changed', false, 'request', to_jsonb(v_request)); end if;
  if p_decision = 'approved' then
    update public.user_accounts set token_balance = token_balance + v_request.amount, updated_at = now()
    where user_id = v_request.user_id;
    if not found then raise exception 'account not found'; end if;
  end if;
  update public.token_requests set status = p_decision, decided_at = now(), decided_by = p_admin_id,
    credit_kind = case when p_decision = 'approved' then p_kind else null end, admin_note = coalesce(p_note, '')
  where id = p_id returning * into v_request;
  return jsonb_build_object('changed', true, 'request', to_jsonb(v_request));
end;
$$;

-- A short lease prevents concurrent submissions/retries from flooding Telegram.
create function public.claim_token_notification(p_id uuid)
returns setof public.token_requests language sql security definer set search_path = public as $$
  update public.token_requests set notification_claimed_at = now()
  where id = p_id and status = 'pending' and notified_at is null
    and (notification_claimed_at is null or notification_claimed_at < now() - interval '2 minutes')
  returning *;
$$;

create function public.token_admin_overview(p_status text default 'pending', p_search text default '', p_page integer default 0, p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  if p_status not in ('all', 'pending', 'approved', 'rejected') or p_page < 0 or p_page > 100000 then raise exception 'invalid filter'; end if;
  select jsonb_build_object(
    'stats', jsonb_build_object(
      'users', (select count(*) from auth.users),
      'purchased', (select coalesce(sum(amount), 0) from public.token_requests where status = 'approved' and credit_kind = 'purchase'),
      'granted', (select coalesce(sum(amount), 0) from public.token_requests where status = 'approved' and credit_kind = 'grant'),
      'used', (select coalesce(sum(tokens_used), 0) from public.user_accounts),
      'balance', (select coalesce(sum(token_balance), 0) from public.user_accounts where not unlimited_tokens),
      'pending', (select count(*) from public.token_requests where status = 'pending'),
      'undelivered', (select count(*) from public.token_requests where status = 'pending' and notified_at is null),
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

revoke all on function public.create_token_request(uuid, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.decide_token_request(uuid, text, bigint, text, text) from public, anon, authenticated;
revoke all on function public.claim_token_notification(uuid) from public, anon, authenticated;
revoke all on function public.token_admin_overview(text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.create_token_request(uuid, uuid, bigint, text) to service_role;
grant execute on function public.decide_token_request(uuid, text, bigint, text, text) to service_role;
grant execute on function public.claim_token_notification(uuid) to service_role;
grant execute on function public.token_admin_overview(text, text, integer, uuid) to service_role;
