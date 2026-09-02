import type { NextConfig } from "next";

/**
 * Content Security Policy (applied via meta tag in layout.tsx for static export):
 * - default-src 'self': only allow resources from same origin by default
 * - script-src 'self' 'unsafe-inline' 'unsafe-eval': allow inline scripts (Next.js hydration)
 *   + 'unsafe-eval' required by React dev mode
 * - style-src 'self' 'unsafe-inline': allow inline styles (Next.js, styled components)
 * - img-src 'self' data: blob:: allow data: URIs (PNG export), blob: for clipboard
 * - font-src 'self' data:: allow data: font URIs
 * - connect-src 'self': only same-origin API calls
 * - object-src 'none': block <object>, <embed>, <applet>
 * - base-uri 'self': restrict <base> tag
 * - form-action 'self': restrict form submissions
 * - frame-ancestors 'none': prevent clickjacking (X-Frame-Options: DENY equivalent)
 * - upgrade-insecure-requests: force HTTPS
 *
 * Note: Next.js headers() function does not work with output: "export".
 * CSP is applied via <meta http-equiv="Content-Security-Policy"> in layout.tsx.
 */
export const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://z-cdn.chatglm.cn",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ');

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
  // trailingSlash: true — recommended for GitHub Pages static hosting
  trailingSlash: true,
  // images: unoptimized required for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
