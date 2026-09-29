// Run after deploying Edge Functions and setting .env.telegram as Supabase secrets.
// This script never prints bot tokens or signed admin payloads.
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync('.env.telegram', 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
const projectRef = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
if (!/^[a-z]{20}$/.test(projectRef) || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET || !env.TELEGRAM_ADMIN_APP_URL?.startsWith('https://')) throw new Error('Missing configuration');
const api = async (method, body = {}) => {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    if (!data.ok) throw new Error();
    return data.result;
  } catch { throw new Error(`Telegram ${method} failed (credentials hidden)`); }
};
if (process.argv.includes('--inspect')) {
  const me = await api('getMe');
  const hook = await api('getWebhookInfo');
  console.log(JSON.stringify({ username: me.username, webhook: hook.url, pendingUpdates: hook.pending_update_count, lastError: hook.last_error_message || null }));
} else if (process.argv.includes('--vault-sql')) {
  const quote = (s) => `'${s.replaceAll("'", "''")}'`;
  const url = `https://${projectRef}.supabase.co/functions/v1/telegram-admin/retry`;
  // Ignored local file; query without logging its contents, then remove it.
  writeFileSync('local-token-vault.sql', `do $$ declare existing uuid; begin\n${Object.entries({ token_notification_url: url, token_notification_secret: env.TELEGRAM_WEBHOOK_SECRET }).map(([name, value]) => `select id into existing from vault.secrets where name = ${quote(name)};\nif existing is null then perform vault.create_secret(${quote(value)}, ${quote(name)}); else perform vault.update_secret(existing, ${quote(value)}, ${quote(name)}); end if;`).join('\n')}\nend $$;\n`);
  console.log('Vault setup file prepared (secret hidden).');
} else {
  const me = await api('getMe');
  await api('setWebhook', { url: `https://${projectRef}.supabase.co/functions/v1/telegram-admin/webhook`, secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
  await api('setMyCommands', { scope: { type: 'chat', chat_id: 7145160476 }, commands: [{ command: 'start', description: 'Открыть админку Cardcraft' }, { command: 'requests', description: 'Заявки на токены' }, { command: 'stats', description: 'Статистика проекта' }] });
  await api('setChatMenuButton', { chat_id: 7145160476, menu_button: { type: 'web_app', text: 'Админка', web_app: { url: env.TELEGRAM_ADMIN_APP_URL } } });
  await api('sendMessage', { chat_id: 7145160476, text: 'Админка Cardcraft подключена. Заявки на токены будут приходить сюда. /requests — очередь заявок, /stats — статистика. Одобрение после проверки оплаты начисляет токены один раз.', reply_markup: { inline_keyboard: [[{ text: 'Открыть админку', web_app: { url: env.TELEGRAM_ADMIN_APP_URL } }]] } });
  console.log(`Configured @${me.username}; owner-only menu and webhook enabled.`);
}
