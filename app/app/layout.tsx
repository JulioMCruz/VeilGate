import type { Metadata } from 'next';
import './globals.css';
import { WalletProvider } from '@/lib/providers/wallet-provider';

export const metadata: Metadata = {
  title: 'VeilGate — Private Micropayment Paywall',
  description:
    'Pay any content. Reveal nothing. A privacy-preserving paywall on Stellar.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
