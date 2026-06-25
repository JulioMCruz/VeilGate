import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-veil-50 to-white dark:from-veil-900 dark:to-black">
        {children}
      </body>
    </html>
  );
}