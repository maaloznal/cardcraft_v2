-- Durable notification retry, every minute. Secrets are provisioned into Vault at deployment.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create function public.dispatch_token_notifications()
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  if not exists (select 1 from public.token_requests where status = 'pending' and notified_at is null) then return; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'token_notification_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'token_notification_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(url := v_url, headers := jsonb_build_object('Content-Type', 'application/json', 'x-telegram-bot-api-secret-token', v_secret), body := '{}'::jsonb, timeout_milliseconds := 120000);
end;
$$;
revoke all on function public.dispatch_token_notifications() from public, anon, authenticated;
grant execute on function public.dispatch_token_notifications() to service_role;
select cron.schedule('cardcraft-token-notifications', '* * * * *', 'select public.dispatch_token_notifications()');
