begin;
insert into auth.users(id, email, created_at, raw_user_meta_data)
select ('00000000-0000-4000-8100-' || lpad(i::text, 12, '0'))::uuid,
  'clients-fixture-' || i || '@example.invalid', '2026-01-01'::timestamptz + i * interval '1 minute',
  jsonb_build_object('full_name', 'Fixture Person ' || i)
from generate_series(1, 21) i;
do $$ declare r jsonb; begin
  r := public.token_admin_clients('clients-fixture-', 0);
  if (r->>'total')::int <> 21 or jsonb_array_length(r->'clients') <> 20 then raise exception 'test failed: all users and pagination'; end if;
  if r->'clients'->0->>'email' <> 'clients-fixture-21@example.invalid' then raise exception 'test failed: newest first'; end if;
  if (r->'clients'->0->>'requests')::int <> 0 or (r->'clients'->0->>'tokens_purchased')::bigint <> 0 then raise exception 'test failed: users without requests'; end if;
  if (r->'clients'->0->>'token_balance')::bigint <> 50000 then raise exception 'test failed: starting balance'; end if;
  r := public.token_admin_clients('CLIENTS-FIXTURE-', 1);
  if jsonb_array_length(r->'clients') <> 1 then raise exception 'test failed: page two'; end if;
  r := public.token_admin_clients('Fixture Person 21');
  if (r->>'total')::int <> 1 then raise exception 'test failed: name search'; end if;
  r := public.token_admin_clients('clients-fixture-%');
  if (r->>'total')::int <> 0 then raise exception 'test failed: literal search'; end if;
  r := public.token_admin_clients('', 0, '00000000-0000-4000-8100-000000000001');
  if (r->>'total')::int <> 1 then raise exception 'test failed: individual profile'; end if;
  if has_function_privilege('anon', 'public.token_admin_clients(text,integer,uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.token_admin_clients(text,integer,uuid)', 'execute')
    or not has_function_privilege('service_role', 'public.token_admin_clients(text,integer,uuid)', 'execute')
  then raise exception 'test failed: private RPC'; end if;
end $$;
rollback;
