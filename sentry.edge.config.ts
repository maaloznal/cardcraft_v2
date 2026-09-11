/**
 * Sentry edge config (P4 Monitoring).
 *
 * Initializes Sentry on the edge runtime (middleware).
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || 'https://cae9507f3f9203097c2fe2618b7e8fba@o4508235660328960.ingest.us.sentry.io/4508298647961600',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_DEBUG === 'true',
});
