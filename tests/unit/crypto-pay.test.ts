// @vitest-environment node
import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { invoiceMatches, safeInvoiceUrl, usdtMicros, verifyCryptoSignature } from '../../supabase/functions/_shared/crypto-pay-contract';
const token = 'fixture-crypto-token';
const raw = '{ "update_type": "invoice_paid", "payload": {} }';
const signature = createHmac('sha256', createHash('sha256').update(token).digest()).update(raw).digest('hex');
describe('Crypto Pay verification', () => {
  it('verifies the original bytes with an independent signature', async () => expect(await verifyCryptoSignature(raw, signature, token)).toBe(true));
  it('rejects altered JSON, another token, missing and malformed signatures', async () => {
    for (const [body, sig, key] of [[JSON.stringify(JSON.parse(raw)), signature, token], [raw, signature, 'other'], [raw, '', token], [raw, 'z'.repeat(64), token]]) expect(await verifyCryptoSignature(body, sig, key)).toBe(false);
  });
  it('checks invoice identity, amount, currency and order', () => {
    const request = { id: 'order', crypto_invoice_id: 42, payment_amount_micros: 1234567 };
    const invoice = { invoice_id: 42, payload: 'order', currency_type: 'crypto', asset: 'USDT', amount: '1.234567' };
    expect(invoiceMatches(invoice, request)).toBe(true);
    for (const altered of [{ invoice_id: 43 }, { payload: 'other' }, { currency_type: 'fiat' }, { asset: 'USDC' }, { amount: '1.234566' }, { amount: '1e0' }, { amount: '1.2345671' }]) expect(invoiceMatches({ ...invoice, ...altered }, request)).toBe(false);
  });
  it('preserves exact micro amounts', () => {
    expect(usdtMicros('1.000001')).toBe(1000001);
    expect(usdtMicros('100000000')).toBe(100000000000000);
  });
  it('restricts payment links to official HTTPS hosts', () => {
    expect(safeInvoiceUrl('https://t.me/CryptoBot?start=invoice')).toBe(true);
    for (const url of ['javascript:alert(1)', 'https://t.me.evil.test', 'http://t.me', 'https://user:pass@t.me']) expect(safeInvoiceUrl(url)).toBe(false);
  });
});
