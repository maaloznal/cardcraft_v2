import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Next.js config for Cardcraft.
 *
 * PRIORITY 4 (Monitoring): Sentry wrapper added for error tracking +
 * source maps upload (requires SENTRY_AUTH_TOKEN env var).
 *
 * PRIORITY 19 (Security hardening):
 *   - CSP is now nonce-based, generated per-request in src/middleware.ts.
 *   - HSTS (Strict-Transport-Security) added in middleware.
 *
 * PRIORITY 9.1 (Bundle analysis):
 *   - @next/bundle-analyzer wrapped via withBundleAnalyzer.
 *   - Run `ANALYZE=true bun run build` to generate reports at .next/analyze/.
 */

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false, // Disabled: causes double-mount flickering in dev
  allowedDevOrigins: ["*.space-z.ai"],
  // P4: Sentry source maps — upload to Sentry during build
  productionBrowserSourceMaps: true, // Generate source maps for Sentry upload
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ]
      }
    ];
  }
};

// P4: Sentry config wrapper
const sentryConfig = withSentryConfig(nextConfig, {
  org: 'maaloznal',
  project: 'cardcraft',
  silent: true,
  // Source maps upload requires SENTRY_AUTH_TOKEN env var
  // (set in .env — uploaded during production build)
});

export default withBundleAnalyzer(sentryConfig);
