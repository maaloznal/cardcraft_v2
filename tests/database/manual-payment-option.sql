begin;
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000088','manual-option@example.invalid');
update public.token_payment_settings set price_per_10000_micros = 100000 where id = 1;
do $$ declare r jsonb; rid uuid := '00000000-0000-4000-8000-000000000098'; uid uuid := '00000000-0000-4000-8000-000000000088'; before_balance bigint; after_balance bigint; begin
  select token_balance into before_balance from public.user_accounts where user_id = uid;
  r := public.create_paid_token_request(uid, rid, 10000, '', 'ton', 100000, '');
  if r->>'payment_provider' <> 'manual' or (r->>'payment_amount_micros')::bigint <> 1000000 or r->>'payment_address' is null then raise exception 'manual invoice invalid'; end if;
  update public.token_payment_settings set price_per_10000_micros = 2000000 where id = 1;
  r := public.create_paid_token_request(uid, rid, 10000, '', 'tron', 2000000, '');
  if (r->>'payment_amount_micros')::bigint <> 1000000 or r->>'payment_network' <> 'ton' then raise exception 'saved quote changed'; end if;
  perform public.set_token_payment_hash(uid, rid, 'manual-fixture-hash');
  select token_balance into after_balance from public.user_accounts where user_id = uid;
  if after_balance <> before_balance then raise exception 'hash incorrectly credits account'; end if;
  perform public.decide_token_request(rid, 'approved', 7145160476, 'purchase', 'Verified manually');
  perform public.decide_token_request(rid, 'approved', 7145160476, 'purchase', 'Verified manually');
  select token_balance into after_balance from public.user_accounts where user_id = uid;
  if after_balance <> before_balance + 10000 then raise exception 'manual credit not exactly once'; end if;
end $$;
rollback;
