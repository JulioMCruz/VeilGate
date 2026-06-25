'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useWallet } from '@/lib/providers/wallet-provider';
import { truncate } from '@/components/ui';

export default function ConnectPage() {
  const router = useRouter();
  const { address, isConnected, isConnecting, error, connect } = useWallet();

  // If already connected, offer to continue (don't auto-redirect — keep it explicit).
  useEffect(() => {
    /* no-op: explicit navigation below */
  }, [isConnected]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-6 text-sm text-gray-500 hover:text-veil-400">
        ← Back to home
      </Link>

      <div className="rounded-2xl border border-veil-900/70 bg-gray-900/60 p-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-veil-600 text-xl text-white">
          ⛓
        </div>
        <h1 className="text-2xl font-bold">Connect your Freighter wallet</h1>
        <p className="mt-2 text-sm text-gray-400">
          Freighter is a free browser extension that manages your Stellar keys. VeilGate
          reads only your public address. Your private key stays in Freighter — we never
          touch it.
        </p>

        <div className="mt-6">
          {isConnected ? (
            <div className="rounded-xl border border-green-500/40 bg-green-950/30 p-4">
              <p className="text-sm font-medium text-green-300">
                Connected — {truncate(address ?? '')}
              </p>
              <button
                onClick={() => router.push('/dashboard/pay')}
                className="mt-3 w-full rounded-xl bg-veil-600 px-4 py-3 text-sm font-medium text-white hover:bg-veil-500"
              >
                Open dashboard →
              </button>
            </div>
          ) : (
            <button
              onClick={() => connect().catch(() => {})}
              disabled={isConnecting}
              className="w-full rounded-xl bg-veil-600 px-4 py-3 text-sm font-medium text-white hover:bg-veil-500 disabled:opacity-50"
            >
              {isConnecting ? 'Waiting for you to approve in Freighter…' : 'Connect Freighter'}
            </button>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-300">
              <p>{error}</p>
              {error.includes('not installed') && (
                <a
                  href="https://freighter.app"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-block underline"
                >
                  Install Freighter →
                </a>
              )}
            </div>
          )}
        </div>

        <hr className="my-6 border-veil-900/70" />
        <p className="text-xs text-gray-500">
          VeilGate requests only your public address. It cannot move funds without your
          explicit approval in Freighter.
        </p>
      </div>
    </main>
  );
}
