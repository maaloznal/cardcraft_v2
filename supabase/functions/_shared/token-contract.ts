export const MIN_TOKENS = 10_000;
export const MAX_TOKENS = 1_000_000_000;
export function validTokenAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= MIN_TOKENS && value <= MAX_TOKENS;
}
export function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
