begin;
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000084','crypto-test@example.invalid');
update public.token_payment_settings set price_per_10000_micros = 100000 where id = 1;
do $$ declare r jsonb; before_balance bigint; after_balance bigint; rid uuid := '00000000-0000-4000-8000-000000000094'; uid uuid := '00000000-0000-4000-8000-000000000084'; begin
  select token_balance into before_balance from public.user_accounts where user_id = uid;
  r := public.create_crypto_token_request(uid, rid, 10000, '', 100000);
  if (r->>'payment_amount_micros')::bigint <> 1000000 then raise exception 'minimum failed'; end if;
  perform public.attach_crypto_invoice(rid, 999999994, 'https://t.me/CryptoBot?start=test', now() + interval '1 hour');
  r := public.attach_crypto_invoice(rid, 999999995, 'https://t.me/CryptoBot?start=other', now() + interval '1 hour');
  if (r->>'crypto_invoice_id')::bigint <> 999999994 then raise exception 'invoice overwrite'; end if;
  begin
    perform public.decide_token_request(rid, 'approved', 7145160476, 'purchase', '');
    raise exception 'manual approval accepted';
  exception when others then if sqlerrm <> 'Crypto Pay confirmation required' then raise; end if; end;
  begin
    perform public.settle_crypto_invoice(rid, 999999994, 'USDT', 999999, now());
    raise exception 'wrong amount accepted';
  exception when others then if sqlerrm <> 'invoice mismatch' then raise; end if; end;
  begin
    perform public.settle_crypto_invoice(rid, 999999994, 'USDC', 1000000, now());
    raise exception 'wrong currency accepted';
  exception when others then if sqlerrm <> 'invoice mismatch' then raise; end if; end;
  perform public.cancel_token_request(uid, rid);
  perform public.settle_crypto_invoice(rid, 999999994, 'USDT', 1000000, now(), '0.03', 'USDT');
  perform public.settle_crypto_invoice(rid, 999999994, 'USDT', 1000000, now());
  select token_balance into after_balance from public.user_accounts where user_id = uid;
  if after_balance <> before_balance + 10000 then raise exception 'credit not exactly once'; end if;
  if not exists(select 1 from public.claim_token_notification(rid)) then raise exception 'paid notification missing'; end if;
  if exists(select 1 from public.claim_token_notification(rid)) then raise exception 'notification lease failed'; end if;
  if has_function_privilege('authenticated', 'public.settle_crypto_invoice(uuid,bigint,text,bigint,timestamptz,text,text)', 'EXECUTE') then raise exception 'public settlement access'; end if;
end $$;
rollback;
