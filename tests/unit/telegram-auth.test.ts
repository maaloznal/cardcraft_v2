// @vitest-environment node
import { createHmac } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { verifyTelegramAdmin } from '../../supabase/functions/_shared/telegram-auth';
import { validTokenAmount } from '../../supabase/functions/_shared/token-contract';

const token = 'test-bot-token';
const owner = '7145160476';
const now = 1800000000000;
function signed(id = Number(owner), age = 0) {
  const params = new URLSearchParams({ auth_date: String(now / 1000 - age), query_id: 'test', user: JSON.stringify({ id, first_name: 'Owner' }) });
  const check = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}
describe('Telegram owner authentication', () => {
  it('accepts an independently signed owner payload', async () => expect(await verifyTelegramAdmin(signed(), token, owner, now)).toBe(true));
  it('rejects another Telegram user even with a valid signature', async () => expect(await verifyTelegramAdmin(signed(123), token, owner, now)).toBe(false));
  it('rejects spoofed owner id', async () => expect(await verifyTelegramAdmin(signed(123).replace('123', owner), token, owner, now)).toBe(false));
  it('rejects expired authentication', async () => expect(await verifyTelegramAdmin(signed(Number(owner), 3601), token, owner, now)).toBe(false));
  it('rejects a future date', async () => expect(await verifyTelegramAdmin(signed(Number(owner), -60), token, owner, now)).toBe(false));
  it('rejects duplicate signed fields', async () => expect(await verifyTelegramAdmin(`${signed()}&user=%7B%7D`, token, owner, now)).toBe(false));
  it('rejects missing hash and empty input', async () => {
    expect(await verifyTelegramAdmin('', token, owner, now)).toBe(false);
    expect(await verifyTelegramAdmin('user=%7B%22id%22%3A7145160476%7D', token, owner, now)).toBe(false);
  });
  it('rejects signatures from another bot', async () => expect(await verifyTelegramAdmin(signed(), 'other-token', owner, now)).toBe(false));
});
describe('token amount boundary', () => {
  it.each([10000, 50000, 100000, 500000, 12345, 1000000000])('accepts %s', (amount) => expect(validTokenAmount(amount)).toBe(true));
  it.each([9999, -10000, 0, 10000.5, 1000000001, Infinity, NaN, '10000', null, true])('rejects %s', (amount) => expect(validTokenAmount(amount)).toBe(false));
});
