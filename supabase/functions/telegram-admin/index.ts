// @ts-nocheck -- Supabase Edge Function (Deno).
import { verifyTelegramAdmin, constantTimeEqual } from '../_shared/telegram-auth.ts';
import { validUuid } from '../_shared/token-contract.ts';
import { OWNER_ID, botToken, db, json, cors, readBody, telegram, menu, overview, decide, retryNotifications } from '../_shared/token-runtime.ts';

const n = (v) => new Intl.NumberFormat('ru-RU').format(v ?? 0);
async function botUpdate(client, update) {
  const callback = update.callback_query;
  const message = callback?.message || update.message;
  const actor = callback?.from || message?.from;
  // Both sender AND private destination must be the owner, including forwarded messages.
  if (String(actor?.id) !== OWNER_ID || String(message?.chat?.id) !== OWNER_ID || message?.chat?.type !== 'private') return;
  const command = callback?.data || message?.text?.split(/\s/)[0] || '';
  if (callback) {
    try { await telegram('answerCallbackQuery', { callback_query_id: callback.id }); } catch { /* Expired UI callback; decision is still idempotent. */ }
  }
  const [action, id, pageText] = command.split(':');
  if (['approve', 'reject'].includes(action) && validUuid(id)) {
    await telegram('sendMessage', { chat_id: OWNER_ID,
      text: action === 'approve' ? 'Оплата проверена? Подтверждение начислит токены клиенту.' : 'Подтвердите отклонение заявки.',
      reply_markup: { inline_keyboard: [[{ text: 'Подтвердить', callback_data: `${action === 'approve' ? 'yes' : 'no'}:${id}` }], [{ text: 'Назад к заявкам', callback_data: 'queue:0' }]] } });
  } else if (['yes', 'no'].includes(action) && validUuid(id)) {
    const result = await decide(client, id, action === 'yes' ? 'approved' : 'rejected');
    await telegram('sendMessage', { chat_id: OWNER_ID, text: result.changed ? (action === 'yes' ? 'Одобрено. Токены начислены.' : 'Заявка отклонена.') : `Заявка уже обработана: ${result.request.status === 'approved' ? 'одобрена' : 'отклонена'}.`, reply_markup: menu() });
  } else if (action === 'history' && validUuid(id)) {
    const page = /^\d{1,5}$/.test(pageText || '') ? Number(pageText) : 0;
    const result = await overview(client, { p_status: 'all', p_user_id: id, p_page: page });
    const user = result.requests[0];
    const history = result.requests.map((r) => `${new Date(r.created_at).toLocaleDateString('ru-RU')} · ${n(r.amount)} · ${r.status === 'approved' ? 'одобрена' : r.status === 'rejected' ? 'отклонена' : 'ожидает'}`).join('\n');
    const rows = [];
    if (page > 0) rows.push({ text: '←', callback_data: `history:${id}:${page - 1}` });
    if ((page + 1) * 20 < result.total) rows.push({ text: '→', callback_data: `history:${id}:${page + 1}` });
    await telegram('sendMessage', { chat_id: OWNER_ID, text: `${user?.email || id}\nКуплено: ${n(user?.tokens_purchased)}\nБонусы: ${n(user?.tokens_granted)}\nИспользовано: ${n(user?.tokens_used)}\nБаланс: ${user?.unlimited_tokens ? 'Без ограничений' : n(user?.token_balance)}\n\n${history || 'Нет заявок.'}`, reply_markup: { inline_keyboard: [...(rows.length ? [rows] : []), ...menu().inline_keyboard] } });
  } else if (action === 'queue' || command === '/requests') {
    const page = /^\d{1,5}$/.test(id || '') ? Number(id) : 0;
    const result = await overview(client, { p_page: page });
    const rows = result.requests.map((r) => [{ text: `${(r.email || r.user_id).slice(0, 35)} · ${n(r.amount)}`, callback_data: `history:${r.user_id}:0` }, { text: '✓', callback_data: `approve:${r.id}` }, { text: '✕', callback_data: `reject:${r.id}` }]);
    const pagination = [];
    if (page > 0) pagination.push({ text: '←', callback_data: `queue:${page - 1}` });
    if ((page + 1) * 20 < result.total) pagination.push({ text: '→', callback_data: `queue:${page + 1}` });
    await telegram('sendMessage', { chat_id: OWNER_ID, text: `Ожидают решения: ${n(result.total)}.\nВыберите клиента для просмотра истории.`, reply_markup: { inline_keyboard: [...rows, ...(pagination.length ? [pagination] : []), ...menu().inline_keyboard] } });
  } else {
    const { stats } = await overview(client);
    await telegram('sendMessage', { chat_id: OWNER_ID, text: `Cardcraft · Администрирование\n\nПользователей: ${n(stats.users)}\nПроектов: ${n(stats.projects)}\nКуплено токенов: ${n(stats.purchased)}\nВыдано бонусов: ${n(stats.granted)}\nИспользовано: ${n(stats.used)}\nОжидают решения: ${n(stats.pending)}\nОжидают уведомления: ${n(stats.undelivered)}\n\n/requests — заявки\n/stats — статистика`, reply_markup: menu() });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Метод не поддерживается.' }, 405);
  const path = new URL(req.url).pathname;
  const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';
  if (path.endsWith('/webhook') || path.endsWith('/retry')) {
    if (!secret || !constantTimeEqual(req.headers.get('x-telegram-bot-api-secret-token') || '', secret)) return json(req, { error: 'Forbidden' }, 403);
    try {
      if (path.endsWith('/retry')) return json(req, { sent: await retryNotifications(db()) });
      await botUpdate(db(), await readBody(req));
      return json(req, { ok: true });
    } catch { return json(req, { error: 'Повторите позже.' }, 503); }
  }
  let body;
  try { body = await readBody(req); } catch { return json(req, { error: 'Некорректный запрос.' }, 400); }
  if (typeof body.initData !== 'string' || !await verifyTelegramAdmin(body.initData, botToken(), OWNER_ID)) {
    return json(req, { error: 'Доступ только владельцу. Откройте админку заново через Telegram.' }, 403);
  }
  try {
    const client = db();
    if (body.action === 'list') {
      const status = body.status ?? 'pending';
      const page = body.page ?? 0;
      if (!['all', 'pending', 'approved', 'rejected'].includes(status) || !Number.isInteger(page) || page < 0 || page > 100000 || (body.userId && !validUuid(body.userId)) || (body.search != null && (typeof body.search !== 'string' || body.search.length > 200))) return json(req, { error: 'Некорректный фильтр.' }, 400);
      return json(req, await overview(client, { p_status: status, p_search: body.search || '', p_page: page, p_user_id: body.userId || null }));
    }
    if (body.action === 'decide') {
      if (!validUuid(body.id) || !['approved', 'rejected'].includes(body.decision) || !['purchase', 'grant'].includes(body.kind) || typeof body.note !== 'string' || body.note.length > 500) return json(req, { error: 'Некорректное решение.' }, 400);
      return json(req, await decide(client, body.id, body.decision, body.kind, body.note));
    }
    if (body.action === 'retry') return json(req, { sent: await retryNotifications(client) });
    return json(req, { error: 'Неизвестное действие.' }, 400);
  } catch { return json(req, { error: 'Не удалось выполнить действие. Обновите данные и повторите.' }, 503); }
});
