-- Client cancellation races safely with admin decisions on the same row lock.
alter table public.token_requests drop constraint token_requests_status_check;
alter table public.token_requests add constraint token_requests_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled'));

create function public.cancel_token_request(p_user_id uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_request public.token_requests;
begin
  select * into v_request from public.token_requests where id = p_id and user_id = p_user_id for update;
  if not found then raise exception 'request not found'; end if;
  if v_request.status = 'cancelled' then return to_jsonb(v_request); end if;
  if v_request.status <> 'pending' then raise exception 'already decided'; end if;
  update public.token_requests set status = 'cancelled', decided_at = now(), decided_by = null,
    admin_note = 'Закрыта клиентом', notification_claimed_at = null
  where id = p_id returning * into v_request;
  return to_jsonb(v_request);
end;
$$;
revoke all on function public.cancel_token_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_token_request(uuid, uuid) to service_role;

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


