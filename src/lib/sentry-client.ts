/**
 * Sentry client initialization (P4 Monitoring).
 *
 * This file is imported explicitly in layout.tsx for Turbopack dev mode.
 * In production, sentry.client.config.ts at root is used by the webpack plugin.
 *
 * Both files have the same Sentry.init() configuration.
 */

import * as Sentry from '@sentry/nextjs';
import { createLogger } from '@/lib/logger';

const log = createLogger('Sentry');

const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  'https://cae9507f3f9203097c2fe2618b7e8fba@o4508235660328960.ingest.us.sentry.io/4508298647961600';

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  enabled: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SENTRY_DEBUG === 'true',
  release: process.env.SENTRY_RELEASE || process.env.npm_package_version,
  environment: process.env.NODE_ENV || 'development',
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered observations',
    ...(process.env.NODE_ENV !== 'production' ? ['Content Security Policy'] : []),
  ],
  denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
});

export const captureException = Sentry.captureException;

log.info('Sentry client initialized', {
  dsn: SENTRY_DSN ? 'configured' : 'missing',
  enabled: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SENTRY_DEBUG === 'true',
});
