// @ts-nocheck -- Supabase Edge Function (Deno).
import { db, json, cors, readBody, notifyRequest, refreshRequestMessage } from '../_shared/token-runtime.ts';
import { cryptoToken, cryptoPay, ensureCryptoInvoice, syncCryptoInvoice } from '../_shared/crypto-pay-runtime.ts';
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
  if (['cancel', 'status', 'invoice'].includes(body.action)) {
    if (!validUuid(body.id)) return json(req, { error: 'Некорректный номер заявки.' }, 400);
    const { data: existing, error: lookupError } = await client.from('token_requests').select('*').eq('id', body.id).eq('user_id', auth.user.id).maybeSingle();
    if (lookupError || !existing) return json(req, { error: 'Заявка не найдена.' }, 404);
    if (existing.payment_provider === 'crypto_pay') {
      try {
        let request = await syncCryptoInvoice(client, existing);
        if (body.action === 'invoice') request = await ensureCryptoInvoice(client, request);
        if (body.action === 'cancel' && request.status === 'pending') {
          if (request.crypto_invoice_id) await cryptoPay('deleteInvoice', { invoice_id: request.crypto_invoice_id });
          const result = await client.rpc('cancel_token_request', { p_user_id: auth.user.id, p_id: request.id });
          if (result.error) throw new Error('Cancel failed');
          request = result.data;
        }
        if (request.status === 'approved') { try { await notifyRequest(client, request.id); } catch { /* Durable retry. */ } }
        return json(req, { request });
      } catch { return json(req, { error: 'Не удалось проверить счёт Crypto Bot. Повторите попытку — начисление не потеряется.' }, 503); }
    }
    if (body.action !== 'cancel') return json(req, { request: existing });
  }
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
  if (!Number.isSafeInteger(body.price) || body.price <= 0) return json(req, { error: 'Обновите стоимость пакета.' }, 400);
  if (!cryptoToken()) return json(req, { error: 'Оплата через Crypto Bot пока недоступна.' }, 503);
  const { data: request, error } = await client.rpc('create_crypto_token_request', { p_user_id: auth.user.id, p_id: body.id, p_amount: body.amount, p_comment: body.comment.trim(), p_expected_price_micros: body.price });
  if (error) return json(req, { error: error.message.includes('price changed') ? 'Цена изменилась. Обновите страницу.' : error.message.includes('rate limit') ? 'Можно создать не более 5 счетов за сутки.' : 'Не удалось сохранить счёт.' }, error.message.includes('rate limit') ? 429 : 409);
  try { return json(req, { request: await ensureCryptoInvoice(client, request) }); }
  catch { return json(req, { error: 'Заявка сохранена, но Crypto Bot временно недоступен. Обновите статус и повторите создание счёта.' }, 503); }
});
