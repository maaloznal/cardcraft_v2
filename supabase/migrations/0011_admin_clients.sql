-- Include every registered user, including those who have never requested tokens.
create function public.token_admin_clients(p_search text default '', p_page integer default 0, p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  if p_page is null or p_page < 0 or p_page > 100000 or p_search is null or length(p_search) > 200 then raise exception 'invalid filter'; end if;
  with matched as (
    select u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null as email_confirmed,
      left(coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), ''), 100) as display_name
    from auth.users u
    where (p_user_id is null or u.id = p_user_id)
      and (trim(p_search) = '' or position(lower(trim(p_search)) in lower(coalesce(u.email, '') || ' ' || u.id::text || ' ' || coalesce(u.raw_user_meta_data->>'full_name', '') || ' ' || coalesce(u.raw_user_meta_data->>'name', ''))) > 0)
  ), page_users as (
    select * from matched order by created_at desc, id desc limit 20 offset p_page * 20
  ), clients as (
    select u.*, coalesce(a.token_balance, 0) as token_balance, coalesce(a.tokens_used, 0) as tokens_used,
      coalesce(a.unlimited_tokens, false) as unlimited_tokens,
      (select count(*) from public.projects p where p.user_id = u.id) as projects,
      (select count(*) from public.token_requests r where r.user_id = u.id) as requests,
      (select count(*) from public.token_requests r where r.user_id = u.id and r.status = 'pending') as pending,
      (select coalesce(sum(r.amount), 0) from public.token_requests r where r.user_id = u.id and r.status = 'approved' and r.credit_kind = 'purchase') as tokens_purchased,
      (select coalesce(sum(r.amount), 0) from public.token_requests r where r.user_id = u.id and r.status = 'approved' and r.credit_kind = 'grant') as tokens_granted
    from page_users u left join public.user_accounts a on a.user_id = u.id
  ) select jsonb_build_object('total', (select count(*) from matched), 'clients', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc, c.id desc) from clients c), '[]'::jsonb)) into v_result;
  return v_result;
end;
$$;
revoke all on function public.token_admin_clients(text, integer, uuid) from public, anon, authenticated;
grant execute on function public.token_admin_clients(text, integer, uuid) to service_role;
