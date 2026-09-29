import { supabase } from '@/lib/supabase/client';
import type { TokenPaymentConfig } from '@/core/types';

export function paymentMicros(tokens: number, price: number): number {
  return Number((BigInt(tokens) * BigInt(price) + BigInt(9999)) / BigInt(10000));
}
export function formatUsdt(micros: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 6 }).format(micros / 1_000_000);
}
export async function getTokenPaymentConfig(): Promise<TokenPaymentConfig> {
  if (!supabase) throw new Error('Supabase не настроен.');
  const [settings, networks] = await Promise.all([
    supabase.from('token_payment_settings').select('price_per_10000_micros').eq('id', 1).single(),
    supabase.from('token_payment_networks').select('id,label,address').eq('active', true).order('position'),
  ]);
  if (settings.error || networks.error) throw new Error('Не удалось загрузить реквизиты. Обновите страницу.');
  return { price: settings.data.price_per_10000_micros, networks: networks.data };
}
