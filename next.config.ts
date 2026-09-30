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
  // Expose basePath to client-side code so OAuth redirects can construct
  // URLs that match Supabase's uri_allow_list (which includes basePath).
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? GITHUB_PAGES_BASE : '',
  },
  // trailingSlash recommended for GitHub Pages static hosting
  trailingSlash: true,
  // images: unoptimized required for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
