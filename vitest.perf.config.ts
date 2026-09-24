import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Vitest config for performance benchmarks.
 * Includes tests/perf/** (excluded from default vitest.config.ts).
 *
 * P-MOBILE: increased testTimeout to 30s for CI — shared Ubuntu runners
 * are 2-3x slower than dev machines, and the 100-cards benchmark can
 * take >5s on CI. 30s gives plenty of headroom without masking real hangs.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/perf/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
