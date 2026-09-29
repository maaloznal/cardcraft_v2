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
  let rows: Array<Record<string, unknown>> = [];
  let balance = 50000;
  const submissions: { amount: number; id: string }[] = [];
  const payments: unknown[] = [];
  await page.route('**/auth/v1/**', (route) => route.fulfill({ json: user }));
  await page.route('**/rest/v1/user_accounts*', (route) => route.fulfill({ json: { user_id: user.id, token_balance: balance, tokens_used: 0, unlimited_tokens: false } }));
  await page.route('**/rest/v1/projects*', (route) => route.fulfill({ json: [
    { id: 'project-old', user_id: user.id, name: 'Архив', updated_at: '2026-01-01T10:00:00Z' },
    { id: 'project-new', user_id: user.id, name: 'Новые идеи', updated_at: '2026-09-29T10:00:00Z' },
  ] }));
  await page.route('**/rest/v1/token_requests*', (route) => route.fulfill({ json: new URL(route.request().url()).searchParams.get('status') === 'eq.pending' ? rows.filter((row) => row.status === 'pending') : rows }));
  await page.route('**/rest/v1/token_payment_settings*', (route) => route.fulfill({ json: { price_per_10000_micros: 100000 } }));
  await page.route('**/rest/v1/token_payment_networks*', (route) => route.fulfill({ json: [{ id: 'ton', label: 'TON', address: 'test-ton-address' }, { id: 'tron', label: 'Tron (TRC20)', address: 'test-tron-address' }] }));
  await page.route('**/functions/v1/token-request', async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === 'cancel') {
      rows[0] = { ...rows[0], status: 'cancelled', admin_note: 'Закрыта клиентом' };
      await route.fulfill({ json: { request: rows[0] } }); return;
    }
    if (body.action === 'payment') {
      payments.push(body); rows[0] = { ...rows[0], payment_tx_hash: body.txHash };
      await route.fulfill({ json: { request: rows[0] } }); return;
    }
    submissions.push(body);
    if (submissions.length === 1) { await route.fulfill({ status: 503, json: { error: 'Временная ошибка. Повторите отправку.' } }); return; }
    const created = { ...request, ...body, user_id: user.id, payment_network: body.network, payment_address: 'test-tron-address', payment_amount_micros: 123450, payment_tx_hash: '' };
    rows = [created]; await route.fulfill({ json: { request: created } });
  });
  await page.goto('/account/');
  await expect(page.locator('.account-project-row').first()).toContainText('Новые идеи');
  await page.getByLabel('Найти проект').fill('Архив');
  await expect(page.locator('.account-project-row')).toHaveCount(1);
  await expect(page.locator('.account-project-row')).toContainText('Архив');
  await page.getByLabel('Найти проект').fill('не существует');
  await expect(page.getByText('Ничего не нашлось')).toBeVisible();
  await page.getByRole('button', { name: 'Показать все проекты' }).click();
  await expect(page.locator('.account-project-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Пополнить баланс', exact: true }).click();
  await expect(page.locator('.token-package')).toHaveCount(4);
  await expect(page.locator('.token-package').first()).toContainText('0,1 USDT');
  await expect(page.locator('.token-package').nth(1)).toContainText('0,5 USDT');
  const input = page.getByLabel('Или введите своё количество');
  await input.fill('9999');
  await expect(page.getByRole('button', { name: 'Создать заявку и перейти к оплате' })).toBeDisabled();
  await input.fill('12345');
  await expect(page.locator('.token-payment-total')).toContainText('0,12345 USDT');
  await page.getByLabel('Сеть перевода USDT').selectOption('tron');
  await expect(page.getByLabel('Адрес получателя')).toHaveCount(0);
  await page.getByText('Добавить комментарий', { exact: true }).click();
  await page.getByLabel('Комментарий (необязательно)').fill('Для теста');
  await page.screenshot({ path: test.info().outputPath('account-payment-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Создать заявку и перейти к оплате' }).click();
  await expect(page.locator('.token-section .project-error')).toContainText('Временная ошибка');
  await expect(input).toHaveValue('12345');
  await page.getByRole('button', { name: 'Создать заявку и перейти к оплате' }).click();
  await expect(page.locator('.token-success')).toContainText('Заявка создана');
  expect(submissions).toHaveLength(2);
  expect(submissions[0].id).toBe(submissions[1].id);
  expect(submissions[0].amount).toBe(12345);
  expect(submissions[0]).toMatchObject({ network: 'tron', price: 100000, txHash: '' });
  await expect(page.getByLabel('Адрес получателя', { exact: true })).toHaveValue('test-tron-address');
  await expect(page.getByLabel('Сумма USDT', { exact: true })).toHaveValue('0.12345');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Копировать: адрес получателя' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('test-tron-address');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Заявка создана. Следующий шаг — оплата' })).toBeVisible();
  await page.getByLabel('Хеш транзакции (TXID)').fill('test-transaction');
  await page.screenshot({ path: test.info().outputPath('account-invoice-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Я оплатил — передать на проверку' }).click();
  await expect(page.getByRole('heading', { name: 'Платёж передан на проверку' })).toBeVisible();
  expect(payments).toHaveLength(1);
  expect(submissions).toHaveLength(2);
  rows[0] = { ...rows[0], status: 'approved' }; balance += 12345;
  await page.getByRole('button', { name: 'Обновить статус' }).click();
  await expect(page.locator('.token-success')).toContainText('токенов зачислено');
  await expect(page.locator('.account-balance strong')).toHaveText('62 345');
  await expect(page.locator('.token-invoice')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Пополнить баланс', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Пополнить баланс', exact: true }).click();
  await page.getByRole('button', { name: 'Создать заявку и перейти к оплате' }).click();
  await page.getByRole('button', { name: 'Закрыть заявку', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Подтверждение закрытия заявки' })).toContainText('не возвращает перевод');
  await page.getByRole('button', { name: 'Оставить открытой' }).click();
  await expect(page.locator('.token-invoice')).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть заявку', exact: true }).click();
  await page.getByRole('button', { name: 'Да, закрыть заявку' }).click();
  await expect(page.locator('.token-invoice')).toHaveCount(0);
  await expect(page.locator('.token-success')).toContainText('Заявка закрыта');
  await expect(page.locator('.account-balance strong')).toHaveText('62 345');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('owner finds registered clients without requests and can open their empty history', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route('https://telegram.org/js/**', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.Telegram={WebApp:{initData:"signed-fixture",ready(){},expand(){}}};' }));
  const client = { id: request.user_id, email: 'new@example.com', display_name: 'Новый клиент', email_confirmed: true, created_at: request.created_at, last_sign_in_at: null, token_balance: 50000, tokens_used: 0, tokens_purchased: 0, tokens_granted: 0, projects: 0, requests: 0, pending: 0 };
  const searches: string[] = [];
  await page.route('**/functions/v1/telegram-admin', async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === 'clients') {
      searches.push(body.search);
      const found = !body.search || client.email.includes(body.search);
      await route.fulfill({ json: { total: found ? 1 : 0, clients: found ? [client] : [] } }); return;
    }
    await route.fulfill({ json: { stats: { users: 1, pending: 0, purchased: 0, used: 0, granted: 0, projects: 0, undelivered: 0 }, total: 0, requests: [] } });
  });
  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Клиенты · 1' }).click();
  await expect(page.getByText(client.email, { exact: true })).toBeVisible();
  await expect(page.getByText('Ещё не входил', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('clients-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Поиск по имени, email или ID клиента').fill('missing');
  await page.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Клиенты не найдены' })).toBeVisible();
  expect(searches).toContain('missing');
  await page.getByRole('button', { name: 'Сбросить поиск' }).click();
  await page.getByRole('button', { name: 'История заявок (0)' }).click();
  await expect(page.getByRole('heading', { name: /История клиента/ })).toBeVisible();
  await expect(page.getByText(client.email, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Заявок нет' })).toBeVisible();
  await page.getByRole('button', { name: 'К списку клиентов' }).click();
  await expect(page.getByRole('button', { name: 'История заявок (0)' })).toBeVisible();
});
