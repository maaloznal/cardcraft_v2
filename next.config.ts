import type { NextConfig } from "next";

/**
 * Next.js config for Cardcraft.
 *
 * Static export for GitHub Pages deployment.
 * - output: "export" for GitHub Pages compatibility
 * - basePath: "/cardcraft_v2" for GitHub Pages subdirectory (matches repo name)
 * - trailingSlash: true for GitHub Pages static hosting
 * - images: unoptimized required for static export
 */

const isProd = process.env.NODE_ENV === 'production';
const GITHUB_PAGES_BASE = '/cardcraft_v2';

const nextConfig: NextConfig = {
  // Static export for GitHub Pages
  output: "export",
  // basePath only in production — dev server stays at root for local testing
  basePath: isProd ? GITHUB_PAGES_BASE : '',
  assetPrefix: isProd ? `${GITHUB_PAGES_BASE}/` : '',
  reactStrictMode: true,
  allowedDevOrigins: ["*.space-z.ai"],
  // trailingSlash recommended for GitHub Pages static hosting
  trailingSlash: true,
  // images: unoptimized required for static export
  images: {
    unoptimized: true,
  },
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
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://z-cdn.chatglm.cn; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; report-uri /api/csp-report; report-to csp-endpoint"
          },
          { key: 'Reporting-Endpoints', value: '{"csp-endpoint":{"url":"/api/csp-report","max_age":86400}}' },
        ]
      }
    ];
  }
};

export default nextConfig;
