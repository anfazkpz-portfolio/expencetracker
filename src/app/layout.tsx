import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { PWAProvider } from '@/components/PWAProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Cash Manager | Personal Expense & Ledger Tracker',
  description: 'Minimalist Offline-First Personal Finance & Ledger Manager',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Cash Manager',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">
        <QueryProvider>
          <PWAProvider />
          <ErrorBoundary>
            <AppShell>{children}</AppShell>
          </ErrorBoundary>
        </QueryProvider>
      </body>
    </html>
  );
}

