// @ts-nocheck -- Deno Edge runtime; pure validation/auth modules are checked by tsc and Vitest.
import { createClient } from 'npm:@supabase/supabase-js@2';
export const OWNER_ID = '7145160476';
export const db = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
export const botToken = () => Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
export function cors(req: Request): Record<string, string> {
  const origins = (Deno.env.get('TOKEN_ALLOWED_ORIGINS') || 'https://maaloznal.github.io,http://localhost:3000').split(',').map((s) => s.trim());
  const origin = req.headers.get('origin') || '';
  return { 'Access-Control-Allow-Origin': origins.includes(origin) ? origin : origins[0], 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
}
export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
export async function readBody(req: Request) {
  const text = await req.text();
  if (text.length > 16384) throw new Error('invalid body');
  const result = JSON.parse(text);
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('invalid body');
  return result;
}
export async function telegram(method: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error('Telegram unavailable');
  return data.result;
}
export function menu() {
  const rows = [[{ text: 'Клиенты', callback_data: 'clients:0' }, { text: 'Заявки', callback_data: 'queue:0' }], [{ text: 'Статистика', callback_data: 'stats' }]];
  const url = Deno.env.get('TELEGRAM_ADMIN_APP_URL');
  if (url?.startsWith('https://')) rows.push([{ text: 'Открыть админку', web_app: { url } }]);
  return { inline_keyboard: rows };
}
export async function overview(client, filters = {}) {
  const { data, error } = await client.rpc('token_admin_overview', filters);
  if (error) throw new Error('Database unavailable');
  return data;
}
export async function clientsOverview(client, filters = {}) {
  const { data, error } = await client.rpc('token_admin_clients', filters);
  if (error) throw new Error('Database unavailable');
  return data;
}
const n = (value: number) => new Intl.NumberFormat('ru-RU').format(value ?? 0);
export async function notifyRequest(client, id: string) {
  const { data: claims, error } = await client.rpc('claim_token_notification', { p_id: id });
  if (error) throw new Error('Notification unavailable');
  const request = claims?.[0];
  if (!request) return false;
  try {
    const [{ data: user, error: userError }, { data: account, error: accountError }, details] = await Promise.all([
      client.auth.admin.getUserById(request.user_id),
      client.from('user_accounts').select('*').eq('user_id', request.user_id).single(),
      overview(client, { p_status: 'all', p_user_id: request.user_id }),
    ]);
    if (userError || accountError) throw new Error('Account unavailable');
    const purchase = details.requests[0]?.tokens_purchased ?? 0;
    const message = await telegram('sendMessage', {
      chat_id: OWNER_ID,
      text: `Заявка на ${n(request.amount)} токенов\nКлиент: ${user.user.email || request.user_id}\nID: ${request.user_id}\nБаланс: ${account.unlimited_tokens ? 'Без ограничений' : n(account.token_balance)}\nПриобретено: ${n(purchase)}\nИспользовано: ${n(account.tokens_used)}\nОплата: ${request.payment_amount_micros == null ? 'сумма не установлена' : request.payment_amount_micros / 1000000 + ' USDT'}\nСеть: ${request.payment_network || '—'}\nАдрес: ${request.payment_address || '—'}\nТранзакция: ${request.payment_tx_hash || 'не указана'}\nКомментарий: ${request.comment || '—'}\nЗаявка: ${request.id}\n\nОдобрение начислит токены. Подтвердите оплату перед одобрением.`,
      reply_markup: { inline_keyboard: [
        [{ text: 'Одобрить', callback_data: `approve:${id}` }, { text: 'Отклонить', callback_data: `reject:${id}` }],
        [{ text: 'История клиента', callback_data: `history:${request.user_id}:0` }],
        ...menu().inline_keyboard,
      ] },
    });
    const { error: saveError } = await client.from('token_requests').update({ notified_at: new Date().toISOString(), telegram_message_id: message.message_id }).eq('id', id).eq('payment_tx_hash', request.payment_tx_hash ?? '').eq('status', 'pending');
    if (saveError) throw new Error('Notification persistence unavailable');
    return true;
  } catch {
    await client.from('token_requests').update({ notification_claimed_at: null }).eq('id', id);
    return false;
  }
}
export async function retryNotifications(client) {
  const { data, error } = await client.from('token_requests').select('id').eq('status', 'pending').is('notified_at', null).order('created_at').limit(10);
  if (error) throw new Error('Database unavailable');
  let sent = 0;
  for (const request of data) if (await notifyRequest(client, request.id)) sent++;
  return sent;
}
export async function decide(client, id, decision, kind = 'purchase', note = '') {
  const { data, error } = await client.rpc('decide_token_request', { p_id: id, p_decision: decision, p_admin_id: Number(OWNER_ID), p_kind: kind, p_note: note });
  if (error) throw new Error('Decision unavailable');
  // Cosmetic Telegram updates must never turn a committed credit into a failed API response.
  await refreshRequestMessage(data.request);
  return data;
}

export async function refreshRequestMessage(request) {
  if (request.telegram_message_id) {
    try {
      const label = { approved: 'Одобрено', rejected: 'Отклонено', cancelled: 'Закрыта клиентом' }[request.status] || request.status;
      await telegram('editMessageText', { chat_id: OWNER_ID, message_id: request.telegram_message_id,
        text: `${label}: ${n(request.amount)} токенов\nЗаявка: ${request.id}\nКлиент: ${request.user_id}\n${request.admin_note || ''}`,
        reply_markup: { inline_keyboard: [[{ text: 'История клиента', callback_data: `history:${request.user_id}:0` }], ...menu().inline_keyboard] } });
    } catch { /* The database is authoritative; /requests and Mini App show the decision. */ }
  }
}
