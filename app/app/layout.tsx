import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/lib/providers/wallet-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VeilGate — Unlinkable Payments on Stellar',
  description:
    'A shielded pool on Stellar. Pay anyone — your deposit and the payout cannot be linked on-chain. Zero-knowledge, verified on Soroban.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-screen bg-ink-950 font-sans text-gray-100 antialiased">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
