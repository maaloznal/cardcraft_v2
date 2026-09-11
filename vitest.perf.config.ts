import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Vitest config for performance benchmarks.
 * Includes tests/perf/** (excluded from default vitest.config.ts).
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/perf/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
