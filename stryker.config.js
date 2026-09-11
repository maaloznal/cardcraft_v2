/**
 * Stryker mutation testing config (PRIORITY 18).
 *
 * Runs mutation testing on critical business logic:
 *   - src/state/StateManager.ts
 *   - src/history/HistoryManager.ts
 *   - src/storage/StorageManager.ts
 *   - src/core/utils.ts
 *
 * Run: `bun run test:mutation`
 *
 * Mutation score goal: >80% on critical modules.
 * Stryker mutates the code (changes operators, removes conditions, etc.)
 * and checks if the tests catch the mutation. If tests pass with a
 * mutation → the tests are weak (need strengthening).
 *
 * @type {import('@stryker-mutator/core').StrykerOptions}
 */
export default {
  $schema: './node_modules/@stryker-mutator/core/schema/stryker-core.schema.json',
  packageManager: 'bun',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.ts',
  },
  coverageAnalysis: 'perTest',
  mutate: [
    'src/state/StateManager.ts',
    'src/history/HistoryManager.ts',
    'src/storage/StorageManager.ts',
    'src/core/utils.ts',
  ],
  // Exclude type-only files and test files from mutation
  ignorePatterns: ['tests/**', '*.config.*', 'docs/**'],
  // Thresholds: warn if below, don't fail the build
  thresholds: {
    high: 80,
    low: 60,
    break: 0,
  },
  concurrency: 2,
  timeoutMS: 30000,
};
