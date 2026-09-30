import { supabase } from '@/lib/supabase/client';
import type { TokenPaymentConfig } from '@/core/types';

export function paymentMicros(tokens: number, price: number): number {
  return Math.max(1_000_000, Number((BigInt(tokens) * BigInt(price) + BigInt(9999)) / BigInt(10000)));
}
export function formatUsdt(micros: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 6 }).format(micros / 1_000_000);
}
export async function getTokenPaymentConfig(): Promise<TokenPaymentConfig> {
  if (!supabase) throw new Error('Supabase не настроен.');
  const settings = await supabase.from('token_payment_settings').select('price_per_10000_micros').eq('id', 1).single();
  if (settings.error || settings.data.price_per_10000_micros == null) throw new Error('Не удалось загрузить стоимость. Обновите страницу.');
  return { price: settings.data.price_per_10000_micros, networks: [] };
}
