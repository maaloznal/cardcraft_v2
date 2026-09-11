'use client';

/**
 * SentryProvider — client component that initializes Sentry on the browser.
 *
 * P4: In Next.js App Router, layout.tsx is a server component by default.
 * Imports in server components run on the server, not the browser.
 * This wrapper ensures Sentry.init() runs on the client side.
 *
 * In production, the @sentry/nextjs webpack plugin also injects Sentry
 * via sentry.client.config.ts — this is the Turbopack dev fallback.
 */

import '@/lib/sentry-client';

export function SentryProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
