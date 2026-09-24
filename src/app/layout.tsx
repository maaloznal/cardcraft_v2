import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@fontsource/golos-text";
import "@fontsource/lora";
import "@fontsource/manrope";
// P9.3: removed @fontsource/plus-jakarta-sans — not used by any theme
import "./globals.css";
// P4: Sentry client init — client component wrapper for Turbopack dev
import { SentryProvider } from '@/components/SentryProvider';
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from '@/auth/AuthProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Конструктор Текстовых Карточек — 48 стилей",
  description:
    "Конструктор текстовых карточек: 48 тем, стилизация слов, экспорт в PNG. Редактируйте, стилизуйте и скачивайте карточки.",
  keywords: [
    "карточки",
    "конструктор",
    "PNG",
    "дизайн",
    "стилизация текста",
    "48 тем",
  ],
  authors: [{ name: "Z.ai Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

// P-MOBILE: viewport export (Next.js 16 metadata API).
// - viewportFit: 'cover' enables env(safe-area-inset-*) on iOS Safari, so
//   fixed elements (sidebar, toast, modal) don't overlap the notch / home indicator.
// - maximumScale: 5 keeps the page zoomable for accessibility (WCAG 1.4.4),
//   but initial-scale=1 prevents accidental zoom-in on load.
// - themeColor is picked up by mobile browsers (Android Chrome toolbar, iOS Safari status bar).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          <SentryProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </SentryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
