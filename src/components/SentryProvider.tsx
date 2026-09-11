'use client';

/**
 * SentryProvider — client component that initializes Sentry on the browser.
 *
 * P4: In Next.js App Router, layout.tsx is a server component by default.
 * In PRODUCTION: @sentry/nextjs webpack plugin automatically injects
 *   sentry.client.config.ts — no manual init needed.
 * In DEVELOPMENT (Turbopack): webpack plugin doesn't run, so we need
 *   explicit init via src/lib/sentry-client.ts.
 *
 * This wrapper prevents DOUBLE INITIALIZATION by only importing
 * sentry-client in development mode.
 */

import { useEffect } from 'react';

export function SentryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only init in dev — production uses webpack plugin (sentry.client.config.ts)
    if (process.env.NODE_ENV !== 'production') {
      void import('@/lib/sentry-client');
    }
  }, []);

  return <>{children}</>;
}
