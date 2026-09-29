// @ts-nocheck -- Supabase Edge Function (Deno).
import { db, json, cors, readBody, notifyRequest, refreshRequestMessage } from '../_shared/token-runtime.ts';
import { validTokenAmount, validUuid } from '../_shared/token-contract.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Метод не поддерживается.' }, 405);
  const client = db();
  const bearer = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return json(req, { error: 'Войдите в аккаунт.' }, 401);
  const { data: auth, error: authError } = await client.auth.getUser(bearer);
  if (authError || !auth.user) return json(req, { error: 'Войдите в аккаунт.' }, 401);
  let body;
  try { body = await readBody(req); } catch { return json(req, { error: 'Некорректный запрос.' }, 400); }
  if (body.action === 'cancel') {
    if (!validUuid(body.id)) return json(req, { error: 'Некорректный номер заявки.' }, 400);
    const { data: request, error } = await client.rpc('cancel_token_request', { p_user_id: auth.user.id, p_id: body.id });
    if (error) return json(req, { error: 'Не удалось закрыть заявку. Возможно, она уже обработана — обновите статус.' }, 409);
    await refreshRequestMessage(request);
    return json(req, { request });
  }
  if (body.action === 'payment') {
    if (!validUuid(body.id) || typeof body.txHash !== 'string' || body.txHash.trim().length < 8 || body.txHash.length > 128) return json(req, { error: 'Укажите хеш транзакции (8–128 символов).' }, 400);
    const { data: request, error } = await client.rpc('set_token_payment_hash', { p_user_id: auth.user.id, p_id: body.id, p_hash: body.txHash });
    if (error) return json(req, { error: 'Не удалось обновить платёж. Заявка должна ожидать решения; доступно до трёх исправлений хеша.' }, 409);
    try { await notifyRequest(client, request.id); } catch { /* Durable retry. */ }
    return json(req, { request });
  }
  if (!validTokenAmount(body.amount) || !validUuid(body.id) || typeof body.comment !== 'string' || body.comment.length > 500) {
    return json(req, { error: 'Введите целое количество от 10 000 до 1 000 000 000 токенов и комментарий до 500 символов.' }, 400);
  }
  if (typeof body.network !== 'string' || body.network.length > 20 || !(body.price === null || Number.isSafeInteger(body.price) && body.price > 0) || typeof body.txHash !== 'string' || body.txHash.length > 128) return json(req, { error: 'Проверьте сеть оплаты и реквизиты.' }, 400);
  const { data: request, error } = await client.rpc('create_paid_token_request', { p_user_id: auth.user.id, p_id: body.id, p_amount: body.amount, p_comment: body.comment.trim(), p_network: body.network, p_expected_price_micros: body.price, p_tx_hash: body.txHash });
  if (error) return json(req, { error: error.message.includes('price changed') ? 'Цена изменилась. Обновите страницу, чтобы проверить сумму перед оплатой.' : error.message.includes('rate limit') ? 'Можно отправить не более 5 заявок за сутки.' : 'Не удалось сохранить заявку. Проверьте сеть и повторите попытку.' }, error.message.includes('price changed') ? 409 : error.message.includes('rate limit') ? 429 : 503);
  // A durable request remains visible even if Telegram is temporarily unavailable.
  try { await notifyRequest(client, request.id); } catch { /* Retry worker picks it up. */ }
  return json(req, { request });
});
