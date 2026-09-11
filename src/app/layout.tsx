import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@fontsource/golos-text";
import "@fontsource/lora";
import "@fontsource/manrope";
// P9.3: removed @fontsource/plus-jakarta-sans — not used by any theme
import "./globals.css";
// P4: Sentry client init — client component wrapper for Turbopack dev
import { SentryProvider } from '@/components/SentryProvider';
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
        <SentryProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </SentryProvider>
      </body>
    </html>
  );
}
