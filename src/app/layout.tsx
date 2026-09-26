import type { Metadata, Viewport } from "next";
import Script from "next/script";
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
import { PwaRegistrar } from '@/components/PwaRegistrar';

const APP_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Конструктор Текстовых Карточек — 90 стилей",
  description:
    "Конструктор текстовых карточек: 90 тем, стилизация слов, экспорт в PNG и ZIP. Редактируйте, стилизуйте и скачивайте карточки.",
  keywords: [
    "карточки",
    "конструктор",
    "PNG",
    "дизайн",
    "стилизация текста",
    "90 тем",
  ],
  authors: [{ name: "Z.ai Team" }],
  applicationName: "Cardcraft",
  appleWebApp: {
    capable: true,
    title: "Cardcraft",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: `${APP_BASE_PATH}/pwa-icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${APP_BASE_PATH}/pwa-icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: `${APP_BASE_PATH}/pwa-icon-192.png`, sizes: "192x192", type: "image/png" }],
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
  themeColor: "#ffffff",
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
        <Script id="cardcraft-ui-theme" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem('cardcraft-ui-theme')==='dark'?'dark':'light';document.documentElement.dataset.uiTheme=t;document.documentElement.style.colorScheme=t;document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',t==='dark'?'#09090b':'#ffffff')})}catch(e){document.documentElement.dataset.uiTheme='light';document.documentElement.style.colorScheme='light'}`}
        </Script>
        <PwaRegistrar />
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
