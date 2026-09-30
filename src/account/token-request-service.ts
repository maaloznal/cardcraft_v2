import { supabase } from '@/lib/supabase/client';
import type { TokenRequest } from '@/core/types';

const requestFields = 'id,user_id,amount,status,credit_kind,comment,admin_note,created_at,decided_at,payment_network,payment_address,payment_amount_micros,payment_tx_hash,payment_provider,crypto_invoice_id,crypto_invoice_url,crypto_expires_at,crypto_paid_at';

export async function getPendingTokenRequest(userId: string): Promise<TokenRequest | null> {
  if (!supabase) throw new Error('Supabase не настроен.');
  const { data, error } = await supabase.from('token_requests').select(requestFields).eq('user_id', userId).eq('status', 'pending').maybeSingle();
  if (error) throw new Error('Не удалось проверить активную заявку. Попробуйте ещё раз.');
  if (data?.payment_provider === 'crypto_pay' && data.crypto_invoice_id) {
    try {
      const updated = await invokeTokenRequest({ action: 'status', id: data.id });
      return updated.status === 'pending' ? updated : null;
    } catch { /* Keep the saved invoice visible while Crypto Pay is unavailable. */ }
  }
  return data as TokenRequest | null;
}

export async function listTokenRequests(userId: string, page = 0): Promise<TokenRequest[]> {
  if (!supabase) throw new Error('Supabase не настроен.');
  const { data, error } = await supabase.from('token_requests')
    .select(requestFields)
    .eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * 20, page * 20 + 19);
  if (error) throw new Error('Не удалось загрузить заявки. Повторите попытку.');
  return data as TokenRequest[];
}

export async function submitTokenRequest(id: string, amount: number, comment: string, payment: { network: string; price: number | null; txHash: string }): Promise<TokenRequest> {
  return invokeTokenRequest({ id, amount, comment, ...payment });
}

export async function createCryptoInvoice(id: string): Promise<TokenRequest> {
  return invokeTokenRequest({ action: 'invoice', id });
}

export async function updatePaymentHash(id: string, txHash: string): Promise<TokenRequest> {
  return invokeTokenRequest({ action: 'payment', id, txHash });
}

export async function cancelTokenRequest(id: string): Promise<TokenRequest> {
  return invokeTokenRequest({ action: 'cancel', id });
}

async function invokeTokenRequest(body: Record<string, unknown>): Promise<TokenRequest> {
  if (!supabase) throw new Error('Supabase не настроен.');
  const { data, error } = await supabase.functions.invoke('token-request', { body });
  if (error) {
    let message = 'Не удалось отправить заявку. Повторите попытку — повторного начисления не будет.';
    if (error.context instanceof Response) {
      try { message = (await error.context.json()).error || message; } catch { /* Non-JSON gateway error. */ }
    }
    throw new Error(message);
  }
  return data.request;
}
