'use client';

import { useRouter } from 'next/navigation';
import { useWallet } from '@/lib/providers/wallet-provider';
import { useShieldedTotal } from '@/lib/pending';
import { Card, CopyButton, NetworkPill, truncate } from '@/components/ui';

export default function WalletPage() {
  const router = useRouter();
  const { address, balances, balancesLoading, disconnect } = useWallet();
  const xlm = balances.find((b) => b.asset === 'XLM');
  const shielded = useShieldedTotal(address);

  function handleDisconnect() {
    disconnect();
    router.push('/');
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        Wallet
        <span className="h-2 w-2 rounded-full bg-veil-400" aria-hidden />
      </h1>
      <p className="mt-1 text-sm text-gray-400">Manage your balance, wallet settings and network.</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_3fr]">
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Network</span>
            <NetworkPill />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-sm text-gray-400">Address</span>
            <span className="mono flex items-center gap-1 text-sm text-gray-200">
              {address ? truncate(address, 8, 6) : '—'}
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

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-veil-400">Total balance</p>
          {balancesLoading ? (
            <p className="mt-2 text-sm text-gray-500">Loading…</p>
          ) : xlm ? (
            <p className="mt-1 text-3xl font-bold text-white">
              {Number(xlm.amount).toLocaleString(undefined, { maximumFractionDigits: 7 })}{' '}
              <span className="text-veil-400">XLM</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-gray-500">No balance yet.</p>
          )}
          <div className="mt-4 flex gap-8 border-t border-veil-900/60 pt-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Available</p>
              <p className="mono mt-1 text-sm text-gray-200">
                {xlm ? Number(xlm.amount).toLocaleString(undefined, { maximumFractionDigits: 7 }) : '—'} XLM
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Shielded</p>
              <p className="mono mt-1 text-sm text-gray-200">
                {shielded.toLocaleString(undefined, { maximumFractionDigits: 7 })} XLM
              </p>
              <p className="text-[10px] text-gray-600">pending payouts</p>
            </div>
          </div>
          {balances.filter((b) => b.asset !== 'XLM').length > 0 && (
            <div className="mt-4 space-y-2 border-t border-veil-900/60 pt-3">
              {balances
                .filter((b) => b.asset !== 'XLM')
                .map((b) => (
                  <div key={b.asset} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{b.asset}</span>
                    <span className="mono text-gray-100">
                      {Number(b.amount).toLocaleString(undefined, { maximumFractionDigits: 7 })}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

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

      <div className="mt-6">
        <h2 className="font-semibold text-white">Wallet actions</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {address && (
            <div className="hairline flex items-center gap-3 rounded-xl bg-ink-900/60 p-4 text-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-veil-900/60 text-veil-300">
                ↓
              </span>
              <div className="min-w-0">
                <p className="font-medium text-gray-200">Receive</p>
                <p className="mono truncate text-xs text-gray-500">{truncate(address, 6, 4)}</p>
              </div>
              <CopyButton value={address} label="address" />
            </div>
          )}
          <a
            href={address ? `https://stellar.expert/explorer/testnet/account/${address}` : undefined}
            target="_blank"
            rel="noreferrer noopener"
            className="hairline flex items-center gap-3 rounded-xl bg-ink-900/60 p-4 text-sm text-gray-300 transition hover:bg-ink-900/90 hover:text-white"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-veil-900/60 text-veil-300">
              ⬈
            </span>
            <div>
              <p className="font-medium">View on explorer</p>
              <p className="text-xs text-gray-500">See this wallet on Stellar Explorer</p>
            </div>
          </a>
          <button
            onClick={handleDisconnect}
            className="hairline flex items-center gap-3 rounded-xl bg-ink-900/60 p-4 text-left text-sm text-gray-300 transition hover:bg-ink-900/90 hover:text-white"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-veil-900/60 text-veil-300">
              ⏻
            </span>
            <div>
              <p className="font-medium">Disconnect wallet</p>
              <p className="text-xs text-gray-500">Disconnect this wallet</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
