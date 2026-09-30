export async function verifyCryptoSignature(raw: string, signature: string | null, token: string): Promise<boolean> {
  if (!token || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const encoder = new TextEncoder();
  const secret = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const bytes = Uint8Array.from(signature.match(/../g)!, (hex) => parseInt(hex, 16));
  return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(raw));
}

export function usdtMicros(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{1,10}(?:\.\d{1,6})?$/.test(value)) throw new Error('Invalid USDT amount');
  const [whole, fraction = ''] = value.split('.');
  const micros = BigInt(whole) * BigInt(1000000) + BigInt(fraction.padEnd(6, '0'));
  if (micros > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount overflow');
  return Number(micros);
}

export function invoiceMatches(invoice: { invoice_id?: unknown; payload?: unknown; currency_type?: unknown; asset?: unknown; amount?: unknown }, request: { id: string; crypto_invoice_id?: number | null; payment_amount_micros?: number | null }): boolean {
  try {
    return Number.isSafeInteger(invoice.invoice_id) && Number(invoice.invoice_id) > 0
      && (!request.crypto_invoice_id || request.crypto_invoice_id === invoice.invoice_id)
      && invoice.payload === request.id && invoice.currency_type === 'crypto' && invoice.asset === 'USDT'
      && usdtMicros(invoice.amount) === request.payment_amount_micros;
  } catch { return false; }
}

export function safeInvoiceUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && ['t.me', 'pay.crypt.bot', 'testnet-pay.crypt.bot'].includes(url.hostname);
  } catch { return false; }
}
