import type { Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { localeConfig, type Locale, locales } from '@/lib/i18n/config';
import { fontVariablesFor } from '@/lib/fonts';
import { SkipLink } from '@/components/common/SkipLink';
import '@/app/globals.css';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * Viewport configuration for performance
 * Requirements: 8.1 - Lighthouse performance score 90+
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Get messages for the locale
  const messages = await getMessages();

  // Get direction for the locale
  const direction = localeConfig[locale as Locale]?.direction || 'ltr';

  return (
    <NextIntlClientProvider messages={messages}>
      <div lang={locale} dir={direction} className={`${fontVariablesFor(direction)} min-h-screen bg-background text-foreground antialiased font-sans`}>
        <SkipLink targetId="main-content">Skip to main content</SkipLink>
        {children}

        {/* 自动注册 Service Worker 拦截并拼合 WASM 大文件 */}
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function(err) {
                  console.error('[SW] 注册失败:', err);
                });
              });
            }
          `}
        </Script>
      </div>
    </NextIntlClientProvider>
  );
}
