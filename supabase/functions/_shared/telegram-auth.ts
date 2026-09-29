const encoder = new TextEncoder();

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

async function hmac(key: Uint8Array, value: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value)));
}

// Never authorize using initDataUnsafe or an ID supplied separately by the client.
export async function verifyTelegramAdmin(initData: string, botToken: string, ownerId: string, now = Date.now()): Promise<boolean> {
  if (!initData || initData.length > 8192 || !botToken || !ownerId) return false;
  const params = new URLSearchParams(initData);
  if (new Set(params.keys()).size !== [...params.keys()].length) return false;
  const hash = params.get('hash') ?? '';
  if (!/^[a-f0-9]{64}$/.test(hash)) return false;
  params.delete('hash');
  const authDate = Number(params.get('auth_date'));
  const age = Math.floor(now / 1000) - authDate;
  if (!Number.isInteger(authDate) || age < -30 || age > 3600) return false;
  const check = [...params.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = await hmac(encoder.encode('WebAppData'), botToken);
  const expected = Array.from(await hmac(secret, check), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (!constantTimeEqual(expected, hash)) return false;
  try {
    const user = JSON.parse(params.get('user') ?? 'null');
    return user != null && Number.isSafeInteger(user.id) && String(user.id) === ownerId;
  } catch { return false; }
}
