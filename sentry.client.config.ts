/**
 * Sentry client config (P4 Monitoring).
 *
 * Initializes Sentry on the client side (browser).
 * Captures runtime errors, unhandled promise rejections, and user interactions.
 *
 * Integrates with the app's ErrorBoundary — unhandled errors are automatically
 * sent to Sentry with full stack traces and breadcrumbs.
 */

import * as Sentry from '@sentry/nextjs';
import { createLogger } from '@/lib/logger';

const log = createLogger('Sentry');

const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  'https://cae9507f3f9203097c2fe2618b7e8fba@o4508235660328960.ingest.us.sentry.io/4508298647961600';

Sentry.init({
  dsn: SENTRY_DSN,

  // Set sampling rate for performance monitoring (10% in prod, 100% in dev)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Enable sending client-side errors to Sentry
  enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_DEBUG === 'true',

  // Release identification
  release: process.env.SENTRY_RELEASE || process.env.npm_package_version,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Filter out noisy errors that aren't actionable
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered observations',
    // CSP violations in dev mode (expected with unsafe-inline/unsafe-eval)
    ...(process.env.NODE_ENV !== 'production' ? ['Content Security Policy'] : []),
  ],

  // Deny URLs that shouldn't be tracked (e.g., browser extensions)
  denyUrls: [
    // Browser extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,
  ],

  // Capture breadcrumbs for better debugging
  // (Sentry automatically captures console, click, navigation breadcrumbs)
});

// Export captureException for manual error reporting
export const captureException = Sentry.captureException;

// Log that Sentry is initialized
log.info('Sentry client initialized', {
  dsn: SENTRY_DSN ? 'configured' : 'missing',
  enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_DEBUG === 'true',
});
