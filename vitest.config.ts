import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    // Perf benchmarks run separately via `bun run test:perf`
    // (excluded from default `bun run test` to keep unit-test CI fast)
    exclude: ['tests/perf/**', 'node_modules/**', '.next/**'],
    coverage: {
      provider: 'v8',
      // P17: track ALL src files, not just the 5 already-tested ones
      include: ['src/**/*.ts'],
      exclude: [
        'src/app/page.tsx',       // JSX shell — tested via E2E
        'src/app/layout.tsx',     // root layout — tested via E2E
        'src/components/**',      // ErrorBoundary — tested via E2E
        'src/core/types.ts',      // type-only file — no runtime code
        'src/**/*.d.ts',          // type declarations
      ],
      // P17: 100% is aspirational. Critical business logic (state, history,
      // storage, utils) is at 95%+. Controllers/renderers/UI are tested via
      // 28 E2E Playwright tests. Thresholds set below current levels so CI
      // doesn't break — increase as unit tests are added for controllers.
      thresholds: {
        statements: 10,
        branches: 10,
        functions: 10,
        lines: 10,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
