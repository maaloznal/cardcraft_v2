import { invoiceMatches, safeInvoiceUrl, usdtMicros } from './crypto-pay-contract.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

type DatabaseClient = SupabaseClient<any>;
type CryptoRecord = Record<string, any>;
type CryptoRequest = CryptoRecord & {
  id: string;
  crypto_invoice_id?: number | null;
  payment_amount_micros: number;
};

export const cryptoToken = () => Deno.env.get('CRYPTO_PAY_API_TOKEN') || '';
export async function cryptoPay(method: string, body = {}) {
  if (!cryptoToken()) throw new Error('Crypto Pay not configured');
  const host = Deno.env.get('CRYPTO_PAY_TESTNET') === 'true' ? 'https://testnet-pay.crypt.bot' : 'https://pay.crypt.bot';
  const response = await fetch(`${host}/api/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Crypto-Pay-API-Token': cryptoToken() },
    body: JSON.stringify(body), signal: AbortSignal.timeout(12000),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error('Crypto Pay unavailable');
  return result.result;
}

export async function ensureCryptoInvoice(client: DatabaseClient, request: CryptoRequest) {
  if (request.payment_provider !== 'crypto_pay' || request.status !== 'pending' || request.crypto_invoice_id) return request;
  const invoice = await cryptoPay('createInvoice', {
    currency_type: 'crypto', asset: 'USDT', amount: (request.payment_amount_micros / 1000000).toFixed(6),
    payload: request.id, description: `Cardcraft: ${request.amount} токенов`, expires_in: 3600,
    allow_comments: false, allow_anonymous: true,
  });
  if (!invoiceMatches(invoice, request) || !safeInvoiceUrl(invoice.bot_invoice_url) || !Number.isFinite(Date.parse(invoice.expiration_date))) throw new Error('Invalid invoice');
  const { data, error } = await client.rpc('attach_crypto_invoice', {
    p_id: request.id, p_invoice_id: invoice.invoice_id, p_url: invoice.bot_invoice_url, p_expires: invoice.expiration_date,
  });
  if (error) throw new Error('Invoice persistence unavailable');
  // Never expose an orphan invoice produced by concurrent creation/cancellation.
  if (data.crypto_invoice_id !== invoice.invoice_id) {
    try { await cryptoPay('deleteInvoice', { invoice_id: invoice.invoice_id }); } catch { /* Expires in one hour. */ }
  }
  return data;
}

export async function settleCryptoInvoice(client: DatabaseClient, invoice: CryptoRecord) {
  if (invoice.status !== 'paid') throw new Error('Unpaid invoice');
  const { data: request, error } = await client.from('token_requests').select('*').eq('crypto_invoice_id', invoice.invoice_id).maybeSingle();
  if (error || !request || !invoiceMatches(invoice, request) || !Number.isFinite(Date.parse(invoice.paid_at))) throw new Error('Invoice mismatch');
  const { data, error: settleError } = await client.rpc('settle_crypto_invoice', {
    p_id: request.id, p_invoice_id: invoice.invoice_id, p_asset: invoice.asset, p_amount_micros: usdtMicros(invoice.amount),
    p_paid_at: invoice.paid_at, p_fee_amount: invoice.fee_amount == null ? null : String(invoice.fee_amount), p_fee_asset: invoice.fee_asset || null,
  });
  if (settleError) throw new Error('Payment settlement unavailable');
  return data;
}

export async function syncCryptoInvoice(client: DatabaseClient, request: CryptoRequest) {
  if (!request.crypto_invoice_id || request.status !== 'pending') return request;
  const result = await cryptoPay('getInvoices', { invoice_ids: String(request.crypto_invoice_id) });
  const invoice = result.items?.find((item: CryptoRecord) => item.invoice_id === request.crypto_invoice_id);
  if (!invoice || !invoiceMatches(invoice, request)) throw new Error('Invoice unavailable');
  if (invoice.status === 'paid') return settleCryptoInvoice(client, invoice);
  if (invoice.status === 'expired') {
    const { data, error } = await client.rpc('cancel_token_request', { p_user_id: request.user_id, p_id: request.id });
    if (error) throw new Error('Invoice status unavailable');
    return data;
  }
  return request;
}

export async function reconcileCryptoInvoices(client: DatabaseClient) {
  const { data, error } = await client.from('token_requests').select('*').eq('payment_provider', 'crypto_pay').eq('status', 'pending').not('crypto_invoice_id', 'is', null).order('created_at').limit(1000);
  if (error) throw new Error('Database unavailable');
  if (!data.length) return;
  const result = await cryptoPay('getInvoices', { invoice_ids: data.map((r: CryptoRecord) => r.crypto_invoice_id).join(','), count: 1000 });
  for (const invoice of result.items || []) {
    const request = data.find((r: CryptoRecord) => r.crypto_invoice_id === invoice.invoice_id);
    if (!request || !invoiceMatches(invoice, request)) continue;
    if (invoice.status === 'paid') await settleCryptoInvoice(client, invoice);
    else if (invoice.status === 'expired') {
      const { error: cancelError } = await client.rpc('cancel_token_request', { p_user_id: request.user_id, p_id: request.id });
      if (cancelError) throw new Error('Invoice expiration unavailable');
    }
  }
}
