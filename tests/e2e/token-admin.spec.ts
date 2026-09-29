import { expect, test } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';

const request = { id: '00000000-0000-4000-8000-000000000091', user_id: '00000000-0000-4000-8000-000000000081', email: 'client@example.com', amount: 50000, status: 'pending', comment: 'Для проекта', admin_note: '', created_at: '2026-09-29T10:00:00Z', token_balance: 100, tokens_used: 49900, tokens_purchased: 0, tokens_granted: 0 };
test('admin requires Telegram and does not request private data in an ordinary browser', async ({ page }) => {
  await page.route('https://telegram.org/js/**', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.Telegram={WebApp:{initData:""}};' }));
  let calls = 0;
  await page.route('**/functions/v1/telegram-admin', async (route) => { calls++; await route.fulfill({ json: {} }); });
  await page.goto('/admin/');
  await expect(page.getByRole('heading', { name: 'Откройте через Telegram' })).toBeVisible();
  expect(calls).toBe(0);
});

test('owner can review, confirm a purchase and inspect history on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route('https://telegram.org/js/**', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.Telegram={WebApp:{initData:"signed-test-fixture",ready(){},expand(){}}};' }));
  let status = 'pending';
  const decisions: unknown[] = [];
  await page.route('**/functions/v1/telegram-admin', async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === 'decide') { decisions.push(body); status = 'approved'; await route.fulfill({ json: { changed: true } }); return; }
    await route.fulfill({ json: { stats: { users: 2, pending: status === 'pending' ? 1 : 0, purchased: status === 'pending' ? 0 : 50000, used: 49900, granted: 0, projects: 4, undelivered: 0 }, total: 1, requests: [{ ...request, status }] } });
  });
  await page.goto('/admin/');
  await expect(page.getByText('client@example.com', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('admin-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Одобрить', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(decisions).toHaveLength(0);
  await page.getByLabel('Комментарий клиенту').fill('Оплата получена');
  await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(decisions).toHaveLength(1);
  expect(decisions[0]).toMatchObject({ decision: 'approved', kind: 'purchase', note: 'Оплата получена' });
  await page.getByRole('button', { name: 'История клиента' }).click();
  await expect(page.getByRole('heading', { name: /История клиента/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('mobile menu Escape closes from inside drawer and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Открыть меню' });
  await expect(trigger).not.toBeFocused();
  await trigger.click();
  await page.getByRole('dialog').getByRole('link', { name: 'Документация' }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('account validates amounts, submits custom tokens once, and shows status', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const user = { id: request.user_id, email: request.email, aud: 'authenticated', role: 'authenticated', created_at: request.created_at, app_metadata: {}, user_metadata: {} };
  // Support the existing local dev server as well as the isolated CI fixture URL.
  const localUrl = existsSync('.env') ? readFileSync('.env', 'utf8').match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim() : undefined;
  const urls = ['https://cardcraft-test.supabase.co', process.env.NEXT_PUBLIC_SUPABASE_URL, localUrl].filter(Boolean) as string[];
  await page.addInitScript(({ user, urls }) => {
    const encoded = (value: object) => btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const jwt = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: user.id, aud: 'authenticated', exp })}.fixture`;
    const session = { access_token: jwt, refresh_token: 'fixture', expires_at: exp, expires_in: 3600, token_type: 'bearer', user };
    for (const url of urls) localStorage.setItem(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, JSON.stringify(session));
  }, { user, urls });
  let rows: object[] = [];
  const submissions: { amount: number; id: string }[] = [];
  await page.route('**/auth/v1/**', (route) => route.fulfill({ json: user }));
  await page.route('**/rest/v1/user_accounts*', (route) => route.fulfill({ json: { user_id: user.id, token_balance: 50000, tokens_used: 0, unlimited_tokens: false } }));
  await page.route('**/rest/v1/projects*', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/token_requests*', (route) => route.fulfill({ json: rows }));
  await page.route('**/rest/v1/token_payment_settings*', (route) => route.fulfill({ json: { price_per_10000_micros: 1000000 } }));
  await page.route('**/rest/v1/token_payment_networks*', (route) => route.fulfill({ json: [{ id: 'ton', label: 'TON', address: 'test-ton-address' }, { id: 'tron', label: 'Tron (TRC20)', address: 'test-tron-address' }] }));
  await page.route('**/functions/v1/token-request', async (route) => {
    const body = route.request().postDataJSON(); submissions.push(body);
    const created = { ...request, ...body, user_id: user.id };
    rows = [created]; await route.fulfill({ json: { request: created } });
  });
  await page.goto('/account/');
  await page.getByRole('button', { name: 'Увеличить лимит' }).click();
  for (const amount of ['10 000', '50 000', '100 000', '500 000']) await expect(page.getByRole('button', { name: amount.replaceAll(' ', '\u00a0'), exact: true })).toBeVisible();
  const input = page.getByLabel('Или введите своё количество');
  await input.fill('9999');
  await expect(page.getByRole('button', { name: /Запросить.*токенов/ })).toBeDisabled();
  await input.fill('12345');
  await expect(page.locator('.token-payment-total')).toContainText('1,2345 USDT');
  await page.getByLabel('Сеть перевода').selectOption('tron');
  await expect(page.getByLabel('Адрес получателя')).toHaveValue('test-tron-address');
  await page.getByLabel('Хеш транзакции (если уже оплатили)').fill('test-transaction');
  await page.getByLabel('Комментарий (необязательно)').fill('Для теста');
  await page.screenshot({ path: test.info().outputPath('account-payment-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: /Запросить.*токенов/ }).click();
  await expect(page.getByRole('status')).toContainText('принята');
  expect(submissions).toHaveLength(1);
  expect(submissions[0].amount).toBe(12345);
  expect(submissions[0]).toMatchObject({ network: 'tron', price: 1000000, txHash: 'test-transaction' });
  await expect(page.getByRole('button', { name: 'Заявка на рассмотрении' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
