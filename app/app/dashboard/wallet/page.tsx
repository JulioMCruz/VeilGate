'use client';

import { useRouter } from 'next/navigation';
import { useWallet } from '@/lib/providers/wallet-provider';
import { Card, CopyButton, NetworkPill } from '@/components/ui';

export default function WalletPage() {
  const router = useRouter();
  const { address, balances, balancesLoading, disconnect } = useWallet();

  function handleDisconnect() {
    disconnect();
    router.push('/');
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Wallet</h1>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Network</span>
          <NetworkPill />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm text-gray-400">Address</span>
          <span className="mono flex items-center gap-1 text-sm text-gray-200">
            {address ? address.slice(0, 8) + '…' + address.slice(-6) : '—'}
            {address && <CopyButton value={address} label="address" />}
          </span>
        </div>
        {address && (
          <a
            href={`https://stellar.expert/explorer/testnet/account/${address}`}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-block text-xs text-veil-400 hover:underline"
          >
            View on Stellar Explorer →
          </a>
        )}
      </Card>

      <Card className="mt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-veil-400">
          Balances
        </p>
        {balancesLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <div className="space-y-2">
            {balances.map((b) => (
              <div key={b.asset} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{b.asset}</span>
                <span className="mono text-gray-100">{Number(b.amount).toLocaleString(undefined, { maximumFractionDigits: 7 })}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <p className="text-sm text-gray-300">Need testnet XLM?</p>
        <a
          href="https://lab.stellar.org/account/fund"
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1 inline-block text-sm text-veil-400 hover:underline"
        >
          Fund your account with the Stellar friendbot →
        </a>
      </Card>

      <div className="mt-6 text-center">
        <button
          onClick={handleDisconnect}
          className="rounded-xl border border-veil-900/70 px-6 py-2.5 text-sm text-gray-300 hover:bg-veil-900/40"
        >
          Disconnect wallet
        </button>
      </div>
    </div>
  );
}
