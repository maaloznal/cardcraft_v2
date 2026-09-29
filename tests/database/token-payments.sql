begin;
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000083','payment-test-83@example.invalid');
update public.token_payment_settings set price_per_10000_micros = 1000000 where id = 1;
do $$ declare r jsonb; begin
  begin
    perform public.create_paid_token_request('00000000-0000-4000-8000-000000000083', gen_random_uuid(), 12345, '', 'ton', 1, '');
    raise exception 'test failed: accepted stale price';
  exception when others then if sqlerrm <> 'price changed' then raise; end if; end;
  r := public.create_paid_token_request('00000000-0000-4000-8000-000000000083', '00000000-0000-4000-8000-000000000093', 12345, '', 'tron', 1000000, 'fixture-hash');
  if (r->>'payment_amount_micros')::bigint <> 1234500 then raise exception 'test failed: quote'; end if;
  if r->>'payment_address' <> 'TVY6SunRqpGwmnrmcm8Fm9o8eQG8kGiDS9' then raise exception 'test failed: wallet'; end if;
  update public.token_payment_settings set price_per_10000_micros = 2000000 where id = 1;
  r := public.create_paid_token_request('00000000-0000-4000-8000-000000000083', '00000000-0000-4000-8000-000000000093', 12345, '', 'ton', 2000000, 'changed');
  if (r->>'payment_amount_micros')::bigint <> 1234500 or r->>'payment_network' <> 'tron' then raise exception 'test failed: quote mutated on retry'; end if;
end $$;
rollback;
