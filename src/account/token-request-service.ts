import { supabase } from '@/lib/supabase/client';
import type { TokenRequest } from '@/core/types';

export async function listTokenRequests(userId: string, page = 0): Promise<TokenRequest[]> {
  if (!supabase) throw new Error('Supabase не настроен.');
  const { data, error } = await supabase.from('token_requests')
    .select('id,user_id,amount,status,credit_kind,comment,admin_note,created_at,decided_at,payment_network,payment_address,payment_amount_micros,payment_tx_hash')
    .eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * 20, page * 20 + 19);
  if (error) throw new Error('Не удалось загрузить заявки. Повторите попытку.');
  return data as TokenRequest[];
}

export async function submitTokenRequest(id: string, amount: number, comment: string, payment: { network: string; price: number | null; txHash: string }): Promise<TokenRequest> {
  return invokeTokenRequest({ id, amount, comment, ...payment });
}

export async function updatePaymentHash(id: string, txHash: string): Promise<TokenRequest> {
  return invokeTokenRequest({ action: 'payment', id, txHash });
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
