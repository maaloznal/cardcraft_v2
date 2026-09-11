/**
 * Next.js middleware — generates a per-request nonce and injects it into
 * the Content-Security-Policy header.
 *
 * PRIORITY 19 (Security hardening): replaces 'unsafe-inline' + 'unsafe-eval'
 * in script-src with a nonce-based policy. The nonce is also added to
 * <html> data-csp-nonce attribute so client code can read it (if needed).
 *
 * Note: Next.js 16 with Turbopack injects inline scripts for HMR/dev.
 * In dev we keep 'unsafe-inline' for scripts (Next requirement); in
 * production we use strict nonce-based CSP.
 */

import { NextResponse, type NextRequest } from 'next/server';

/** Generate a random base64 nonce (at least 128 bits). */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function middleware(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV !== 'production';

  // Build CSP. In dev, Next.js needs 'unsafe-inline' + 'unsafe-eval' for HMR.
  // In production, we use strict nonce-based CSP.
  const scriptSrc = isDev
    ? `'self' 'unsafe-inline' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}'`;

  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`, // Tailwind + inline styles require 'unsafe-inline'
    `img-src 'self' data: blob: https://z-cdn.chatglm.cn`, // allow logo CDN
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    // P19.8: CSP reporting — violations reported to /api/csp-report
    `report-uri /api/csp-report`,
    `report-to csp-endpoint`,
  ].join('; ');

  // P19.8: Reporting-Endpoints header (modern CSP reporting API)
  const reportingEndpoints = JSON.stringify({
    'csp-endpoint': {
      url: '/api/csp-report',
      max_age: 86400,
    },
  });

  // Clone the response and set headers
  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  // P19-3: HSTS — enforce HTTPS for 1 year (including subdomains)
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // X-XSS-Protection is deprecated but harmless; keep for legacy browsers
  response.headers.set('X-XSS-Protection', '1; mode=block');
  // P19.8: Reporting-Endpoints for CSP violation reports
  response.headers.set('Reporting-Endpoints', reportingEndpoints);

  // Expose nonce to client via a custom header (client code can read it if needed)
  response.headers.set('x-csp-nonce', nonce);

  return response;
}

export const config = {
  // Run on all routes except static assets
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
