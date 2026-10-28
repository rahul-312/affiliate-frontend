import type { Metadata } from 'next';
import { DM_Serif_Display } from 'next/font/google';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';
import './globals.css';

const display = DM_Serif_Display({ weight: '400', subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: 'Affiliate Hub Dashboard',
  description: 'Review affiliates and commissions, and run payouts.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
