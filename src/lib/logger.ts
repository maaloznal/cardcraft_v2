/**
 * Logger — structured, leveled logger for Cardcraft.
 *
 * PRIORITY 20: replaces raw console.* calls with a controlled logger.
 * In production: only warn + error are emitted.
 * In development: debug + info + warn + error are emitted.
 *
 * All log entries have:
 *   - timestamp (ISO 8601)
 *   - level (debug/info/warn/error)
 *   - scope (e.g. 'Cardcraft', 'perf', 'ErrorBoundary')
 *   - message + optional context object
 *
 * Public API:
 *   logger.debug(msg, ctx?)
 *   logger.info(msg, ctx?)
 *   logger.warn(msg, ctx?)
 *   logger.error(msg, ctx?)
 *   logger.setLevel(level) — override runtime level
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

/** Current minimum level (set based on NODE_ENV). */
let currentLevel: LogLevel =
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'production' ? 'warn' : 'debug';

/** Override the minimum log level at runtime. */
export function setLevel(level: LogLevel): void {
  currentLevel = level;
}

/** Format a log entry as a structured string. */
function formatEntry(scope: string, msg: string, ctx?: unknown): string {
  const ts = new Date().toISOString();
  const ctxStr = ctx !== undefined ? ' ' + JSON.stringify(ctx) : '';
  return `[${ts}] [${scope}] ${msg}${ctxStr}`;
}

/** Core log function — delegates to console based on level. */
function log(level: LogLevel, scope: string, msg: string, ctx?: unknown): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) return;
  const formatted = formatEntry(scope, msg, ctx);
   
  switch (level) {
    case 'debug':
       
      console.debug(formatted);
      break;
    case 'info':
       
      console.info(formatted);
      break;
    case 'warn':
       
      console.warn(formatted);
      break;
    case 'error':
       
      console.error(formatted);
      break;
  }
}

/** Create a scoped logger (all entries prefixed with the scope). */
export function createLogger(scope: string) {
  return {
    debug: (msg: string, ctx?: unknown) => log('debug', scope, msg, ctx),
    info: (msg: string, ctx?: unknown) => log('info', scope, msg, ctx),
    warn: (msg: string, ctx?: unknown) => log('warn', scope, msg, ctx),
    error: (msg: string, ctx?: unknown) => log('error', scope, msg, ctx),
  };
}

/** Default logger (scope: 'Cardcraft'). */
export const logger = createLogger('Cardcraft');
