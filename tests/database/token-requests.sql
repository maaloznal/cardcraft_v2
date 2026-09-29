-- Run on a database with migration 0008. Fixtures and changes are rolled back.
begin;
insert into auth.users(id, email) values ('00000000-0000-4000-8000-000000000081', 'token-test-81@example.invalid'), ('00000000-0000-4000-8000-000000000082', 'token-test-82@example.invalid');
do $$
declare r jsonb; balance_before bigint; amount_after bigint;
begin
  select token_balance into balance_before from public.user_accounts where user_id = '00000000-0000-4000-8000-000000000081';
  begin
    perform public.create_token_request('00000000-0000-4000-8000-000000000081', gen_random_uuid(), 9999, '');
    raise exception 'test failed: accepted below minimum';
  exception when others then if sqlerrm <> 'invalid request' then raise; end if; end;
  r := public.create_token_request('00000000-0000-4000-8000-000000000081', '00000000-0000-4000-8000-000000000091', 10000, 'fixture');
  r := public.create_token_request('00000000-0000-4000-8000-000000000081', gen_random_uuid(), 50000, 'duplicate');
  if r->>'id' <> '00000000-0000-4000-8000-000000000091' then raise exception 'test failed: duplicate pending'; end if;
  begin
    perform public.decide_token_request('00000000-0000-4000-8000-000000000091', 'approved', 123, 'purchase', '');
    raise exception 'test failed: unauthorized admin';
  exception when others then if sqlerrm <> 'forbidden' then raise; end if; end;
  perform public.decide_token_request('00000000-0000-4000-8000-000000000091', 'approved', 7145160476, 'purchase', 'paid');
  r := public.decide_token_request('00000000-0000-4000-8000-000000000091', 'approved', 7145160476, 'purchase', 'retry');
  if (r->>'changed')::boolean then raise exception 'test failed: repeated credit'; end if;
  r := public.decide_token_request('00000000-0000-4000-8000-000000000091', 'rejected', 7145160476, 'purchase', 'late rejection');
  if r->'request'->>'status' <> 'approved' then raise exception 'test failed: decision overwritten'; end if;
  select token_balance into amount_after from public.user_accounts where user_id = '00000000-0000-4000-8000-000000000081';
  if amount_after <> balance_before + 10000 then raise exception 'test failed: incorrect balance'; end if;
  perform public.create_token_request('00000000-0000-4000-8000-000000000081', '00000000-0000-4000-8000-000000000092', 50000, '');
  perform public.decide_token_request('00000000-0000-4000-8000-000000000092', 'rejected', 7145160476, 'purchase', '');
  if (select token_balance from public.user_accounts where user_id = '00000000-0000-4000-8000-000000000081') <> amount_after then raise exception 'test failed: rejection changed balance'; end if;
  r := public.token_admin_overview('all', '', 0, '00000000-0000-4000-8000-000000000081');
  if (r->>'total')::integer <> 2 or (r->'requests'->0->>'tokens_purchased')::bigint <> 10000 then raise exception 'test failed: purchase accounting'; end if;
  if has_function_privilege('authenticated', 'public.decide_token_request(uuid,text,bigint,text,text)', 'EXECUTE') then raise exception 'test failed: authenticated can credit'; end if;
  if has_function_privilege('anon', 'public.token_admin_overview(text,text,integer,uuid)', 'EXECUTE') then raise exception 'test failed: public admin statistics'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000082', true);
do $$ begin
  if exists (select 1 from public.token_requests) then raise exception 'test failed: other user can read requests'; end if;
  begin
    insert into public.token_requests(user_id, amount) values ('00000000-0000-4000-8000-000000000082', 10000);
    raise exception 'test failed: direct insert';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
