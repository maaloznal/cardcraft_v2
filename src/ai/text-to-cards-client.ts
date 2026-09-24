import { supabase } from '@/lib/supabase/client';
import {
  AI_TEXT_MAX_LENGTH,
  normalizeAiTargetChars,
  isAiRole,
  isAiTextMode,
  parseAiCardsResponse,
  type AiCardsResponse,
  type AiTextMode,
  type AiRole,
} from './text-to-cards-contract';

export interface AiTextRequestOptions {
  mode: AiTextMode;
  role: AiRole;
  targetChars: number;
}

export async function requestTextCards(
  text: string,
  options: AiTextRequestOptions,
  signal?: AbortSignal,
): Promise<AiCardsResponse> {
  const normalized = text.trim();
  const targetChars = normalizeAiTargetChars(options.targetChars);
  if (!normalized || normalized.length > AI_TEXT_MAX_LENGTH || !isAiTextMode(options.mode) || !isAiRole(options.role) || !targetChars) {
    throw new Error(`Введите текст длиной от 1 до ${AI_TEXT_MAX_LENGTH} символов.`);
  }
  if (!supabase) throw new Error('ИИ-функция недоступна: Supabase не настроен.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Войдите в аккаунт, чтобы использовать ИИ-разбивку.');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error('Supabase не настроен.');

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/text-to-cards`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({
      text: normalized,
      mode: options.mode,
      role: options.role,
      targetChars,
      requestId: crypto.randomUUID(),
    }),
  });
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new Error(typeof body?.error === 'string' ? body.error : 'Не удалось обработать текст.');
  }
  return parseAiCardsResponse(body);
}
