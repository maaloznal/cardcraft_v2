/**
 * Next.js instrumentation hook (P4 Monitoring).
 *
 * This file is automatically called by Next.js on server startup.
 * It imports the Sentry server config to initialize error tracking.
 *
 * In production, Sentry is enabled. In development, it's disabled
 * (can be enabled with SENTRY_DEBUG=true env var).
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
