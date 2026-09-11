import type { NextConfig } from "next";

/**
 * Next.js config for Cardcraft.
 *
 * PRIORITY 19 (Security hardening):
 *   - CSP is now nonce-based, generated per-request in src/middleware.ts.
 *     This removes 'unsafe-inline' + 'unsafe-eval' from script-src in production.
 *   - HSTS (Strict-Transport-Security) added in middleware.
 *   - The headers() block here is a FALLBACK for routes not covered by middleware
 *     (static assets). It does NOT include CSP — that's middleware's job.
 */
const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  allowedDevOrigins: ["*.space-z.ai"],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          }
        ]
      }
    ];
  }
};

export default nextConfig;
