// Explicit integration smoke test. Creates temporary users and deletes them in finally.
// Requires .env (public Supabase config), .env.telegram and .env.integration (SUPABASE_SECRET).
import { readFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const read = (path) => Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/).filter((s) => s && !s.startsWith('#')).map((s) => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; }));
const config = { ...read('.env'), ...read('.env.telegram'), ...read('.env.integration') };
const url = config.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, config.SUPABASE_SECRET, { auth: { persistSession: false } });
function initData(id) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'Integration' }) });
  const check = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(config.TELEGRAM_BOT_TOKEN).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}
async function call(name, body, accessToken) {
  const res = await fetch(`${url}/functions/v1/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}
const users = [];
const requestIds = [];
try {
  assert.equal((await call('telegram-admin', { action: 'list', initData: initData(123) })).status, 403);
  assert.equal((await call('telegram-admin/webhook', { message: { text: '/stats' } })).status, 403);
  assert.equal((await call('token-request', { id: randomUUID(), amount: 10000, comment: '' })).status, 401);
  assert.equal((await call('telegram-admin', { action: 'list', initData: initData(7145160476) })).status, 200);
  const password = randomUUID() + 'aZ!';
  for (let i = 0; i < 2; i++) {
    const email = `token-smoke-${randomUUID()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.equal(error, null, 'fixture creation'); users.push(data.user.id);
    const client = createClient(url, config.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const login = await client.auth.signInWithPassword({ email, password });
    assert.equal(login.error, null, 'fixture login');
    users[i] = { id: data.user.id, client, token: login.data.session.access_token };
  }
  const user = users[0];
  const { data: paymentSettings } = await admin.from('token_payment_settings').select('price_per_10000_micros').single();
  const payment = { network: 'ton', price: paymentSettings.price_per_10000_micros, txHash: '' };
  assert.equal((await call('token-request', { id: randomUUID(), amount: 9999, comment: '' }, user.token)).status, 400);
  const id = randomUUID(); requestIds.push(id);
  const created = await call('token-request', { id, amount: 12345, comment: 'Автоматическая проверка. Временный тестовый аккаунт, оплата не требуется.', ...payment }, user.token);
  assert.equal(created.status, 200); assert.equal(created.data.request.amount, 12345);
  assert.equal(created.data.request.payment_network, 'ton');
  assert.equal(created.data.request.payment_amount_micros, Math.ceil(12345 * payment.price / 10000));
  const duplicate = await call('token-request', { id: randomUUID(), amount: 50000, comment: '', ...payment }, user.token);
  assert.equal(duplicate.data.request.id, id);
  const hidden = await users[1].client.from('token_requests').select('id').eq('id', id);
  assert.deepEqual(hidden.data, []);
  assert.equal((await call('token-request', { action: 'payment', id, txHash: 'test-fixture-hash' }, users[1].token)).status, 409);
  const updated = await call('token-request', { action: 'payment', id, txHash: 'test-fixture-hash' }, user.token);
  assert.equal(updated.status, 200);
  assert.equal(updated.data.request.payment_tx_hash, 'test-fixture-hash');
  const signed = initData(7145160476);
  const results = await Promise.all([1, 2, 3].map(() => call('telegram-admin', { action: 'decide', id, decision: 'approved', kind: 'grant', note: 'Integration test', initData: signed })));
  assert(results.every((r) => r.status === 200));
  assert.equal(results.filter((r) => r.data.changed).length, 1, 'exactly one concurrent credit');
  const balance = await user.client.from('user_accounts').select('token_balance').single();
  assert.equal(balance.data.token_balance, 62345, 'one credit, launch balance + 12345');
  const denial = await call('telegram-admin', { action: 'decide', id, decision: 'rejected', kind: 'purchase', note: '', initData: signed });
  assert.equal(denial.data.changed, false);
  console.log('PASS: live auth, minimum amount, submission, pending deduplication, cross-user RLS, concurrent decisions and balance.');
} finally {
  for (const id of requestIds) {
    const { data } = await admin.from('token_requests').select('telegram_message_id').eq('id', id).maybeSingle();
    if (data?.telegram_message_id) {
      try { await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/deleteMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: 7145160476, message_id: data.telegram_message_id }) }); } catch { /* Best-effort cosmetic cleanup. */ }
    }
  }
  for (const user of users) { const { error } = await admin.auth.admin.deleteUser(typeof user === 'string' ? user : user.id); assert.equal(error, null, 'fixture cleanup'); }
  console.log('Temporary users and their token requests removed.');
}
