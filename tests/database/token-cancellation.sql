begin;
insert into auth.users(id,email) values ('00000000-0000-4000-8200-000000000001','cancellation-fixture@example.invalid');
do $$ declare r jsonb; v_id uuid := gen_random_uuid(); v_other uuid := gen_random_uuid(); begin
  r := public.create_token_request('00000000-0000-4000-8200-000000000001', v_id, 10000, '');
  begin
    perform public.cancel_token_request(v_other, v_id);
    raise exception 'test failed: cross-user cancellation';
  exception when others then if sqlerrm <> 'request not found' then raise; end if; end;
  r := public.cancel_token_request('00000000-0000-4000-8200-000000000001', v_id);
  if r->>'status' <> 'cancelled' then raise exception 'test failed: not cancelled'; end if;
  perform public.cancel_token_request('00000000-0000-4000-8200-000000000001', v_id);
  r := public.decide_token_request(v_id, 'approved', 7145160476);
  if (r->>'changed')::boolean then raise exception 'test failed: credited cancelled request'; end if;
  if (select token_balance from public.user_accounts where user_id = '00000000-0000-4000-8200-000000000001') <> 50000 then raise exception 'test failed: balance changed'; end if;
  r := public.token_admin_overview('cancelled', '', 0, '00000000-0000-4000-8200-000000000001');
  if (r->>'total')::int <> 1 then raise exception 'test failed: cancelled history'; end if;
  v_id := gen_random_uuid();
  r := public.create_token_request('00000000-0000-4000-8200-000000000001', v_id, 10000, '');
  if r->>'status' <> 'pending' then raise exception 'test failed: new request after cancellation'; end if;
  perform public.decide_token_request(v_id, 'approved', 7145160476);
  begin
    perform public.cancel_token_request('00000000-0000-4000-8200-000000000001', v_id);
    raise exception 'test failed: cancelled approved request';
  exception when others then if sqlerrm <> 'already decided' then raise; end if; end;
  if has_function_privilege('anon', 'public.cancel_token_request(uuid,uuid)', 'execute') or has_function_privilege('authenticated', 'public.cancel_token_request(uuid,uuid)', 'execute') then raise exception 'test failed: exposed RPC'; end if;
end $$;
rollback;
