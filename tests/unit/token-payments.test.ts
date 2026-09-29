import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase/client', () => ({ supabase: null }));
import { formatUsdt, paymentMicros } from '@/account/payment-service';

describe('USDT quote precision', () => {
  it('prices presets and custom quantities without floating-point drift', () => {
    expect(paymentMicros(10000, 1000000)).toBe(1000000);
    expect(paymentMicros(50000, 1000000)).toBe(5000000);
    expect(paymentMicros(12345, 1000000)).toBe(1234500);
  });
  it('rounds fractions upwards to one micro-USDT', () => expect(paymentMicros(10001, 1)).toBe(2));
  it('supports maximum quantities without intermediate integer overflow', () => expect(paymentMicros(1000000000, 1000000000)).toBe(100000000000000));
  it('formats six decimal places without dropping a payable micro-USDT', () => expect(formatUsdt(1)).toBe('0,000001'));
});
