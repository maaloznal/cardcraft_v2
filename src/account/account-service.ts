import { supabase } from '@/lib/supabase/client';

export const INITIAL_TOKEN_BALANCE = 50_000;

export interface UserAccount {
  user_id: string;
  token_balance: number;
  tokens_used: number;
  unlimited_tokens: boolean;
  created_at: string;
  updated_at: string;
}

export async function getUserAccount(userId: string): Promise<UserAccount> {
  if (!supabase) throw new Error('Supabase не настроен.');
  const { data, error } = await supabase
    .from('user_accounts')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data as UserAccount;
}

