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
  packageManager: 'npm', // Stryker doesn't support 'bun'
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
  // Exclude everything else from mutation + type checking
  ignorePatterns: ['tests/**', '*.config.*', 'docs/**', 'skills/**', 'examples/**', '.next/**'],
  disableTypeChecks: false,
  thresholds: {
    high: 80,
    low: 60,
    break: 0,
  },
  concurrency: 2,
  timeoutMS: 30000,
};
