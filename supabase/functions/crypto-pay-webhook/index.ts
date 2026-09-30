import { db, notifyRequest } from '../_shared/token-runtime.ts';
import { cryptoToken, settleCryptoInvoice } from '../_shared/crypto-pay-runtime.ts';
import { verifyCryptoSignature } from '../_shared/crypto-pay-contract.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!cryptoToken()) return new Response('Unavailable', { status: 503 });
  const raw = await req.text();
  if (raw.length > 65536) return new Response('Payload too large', { status: 413 });
  if (!await verifyCryptoSignature(raw, req.headers.get('crypto-pay-api-signature'), cryptoToken())) return new Response('Unauthorized', { status: 401 });
  let update;
  try { update = JSON.parse(raw); } catch { return new Response('Invalid JSON', { status: 400 }); }
  if (update?.update_type !== 'invoice_paid') return new Response('OK');
  try {
    const client = db();
    const request = await settleCryptoInvoice(client, update.payload);
    // Settlement commits first; the durable notification worker retries Telegram failures.
    try { await notifyRequest(client, request.id); } catch { /* Durable retry. */ }
    return new Response('OK');
  } catch { return new Response('Payment processing unavailable', { status: 503 }); }
});
