/**
 * Sentry server config (P4 Monitoring).
 *
 * Initializes Sentry on the server side (Node.js runtime).
 * Captures runtime errors, unhandled rejections, and performance data.
 *
 * DSN is set via SENTRY_DSN environment variable.
 * Source maps are uploaded during build via SENTRY_AUTH_TOKEN.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || 'https://cae9507f3f9203097c2fe2618b7e8fba@o4508235660328960.ingest.us.sentry.io/4508298647961600';

Sentry.init({
  dsn: SENTRY_DSN,

  // Set sampling rate for performance monitoring (10% in prod, 100% in dev)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Set sampling rate for profiling (same as traces)
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Enable sending client-side errors to Sentry
  enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_DEBUG === 'true',

  // Release identification — uses git commit hash if available
  release: process.env.SENTRY_RELEASE || process.env.npm_package_version,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Filter out noisy errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered observations',
  ],
});
