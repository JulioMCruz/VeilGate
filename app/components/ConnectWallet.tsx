'use client';

import { useState } from 'react';
import { connectWallet } from '@/lib/wallet';
import type { WalletAddress } from '@/lib/types';

interface ConnectWalletProps {
  onConnect: (wallet: WalletAddress) => void;
}

export function ConnectWallet({ onConnect }: ConnectWalletProps) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const wallet = await connectWallet();
      onConnect(wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="rounded-xl bg-veil-600 px-8 py-3 text-white shadow hover:bg-veil-500 transition disabled:opacity-50"
      >
        {connecting ? 'Connecting...' : 'Connect Freighter'}
      </button>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      <p className="text-xs text-gray-500">
        Install Freighter:{' '}
        <a
          href="https://freighter.app"
          target="_blank"
          rel="noreferrer noopener"
          className="underline"
        >
          freighter.app
        </a>
      </p>
    </div>
  );
}