'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useWallet } from '@/lib/providers/wallet-provider';
import { DENOMINATIONS } from '@/lib/pool-config';
import { countDeposits } from '@/lib/pool';
import { useShieldedTotal } from '@/lib/pending';
import { Card, ExplorerLink, truncate } from '@/components/ui';
import { TxLog } from '@/components/tx-log';
import { UseCases } from '@/components/use-cases';
import { VerifiedOnchain } from '@/components/verified-onchain';

/**
 * Dashboard home — follows `dashboard home page ref.png`. Every number is real:
 * balance from the wallet, per-pool deposit counts from the same `countDeposits`
 * the Pay screen uses, and "shielded" from locally-stored pending notes. No USD /
 * notifications / invented figures.
 */

// One accent color per denomination — purely visual grouping (fixed, not
// data-driven) so the three pools scan as distinct rows at a glance.
const POOL_ACCENT: Record<string, { bg: string; text: string }> = {
  [DENOMINATIONS[0].poolId]: { bg: 'bg-veil-900/60', text: 'text-veil-300' }, // 0.1 XLM — violet
  [DENOMINATIONS[1].poolId]: { bg: 'bg-emerald-900/40', text: 'text-emerald-300' }, // 1 XLM — green
  [DENOMINATIONS[2].poolId]: { bg: 'bg-amber-900/40', text: 'text-amber-300' }, // 10 XLM — gold
};
const POOL_ACCENT_DEFAULT = { bg: 'bg-veil-900/60', text: 'text-veil-300' };
export function DashboardHome() {
  const { address, balances } = useWallet();
  const xlm = balances.find((b) => b.asset === 'XLM');

  // Real per-pool deposit counts (anonymity-set size) → also the pool share %.
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!address) return;
    let live = true;
    Promise.all(
      DENOMINATIONS.map((d) => countDeposits(d.poolId, address).catch(() => 0))
    ).then((res) => {
      if (!live) return;
      const map: Record<string, number> = {};
      DENOMINATIONS.forEach((d, i) => (map[d.poolId] = res[i]));
      setCounts(map);
    });
    return () => {
      live = false;
    };
  }, [address]);
  const totalDeposits = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  // Real "shielded" total = sum of pending notes' denominations (deposited, not yet paid out).
  const shielded = useShieldedTotal(address);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Welcome hero with the mascot art bleeding off the right */}
      <section className="hairline relative overflow-hidden rounded-2xl bg-ink-900/60 p-8">
        <div className="relative z-10 max-w-lg">
          <h1 className="text-2xl font-bold text-white sm:text-display-sm">Welcome back</h1>
          <p className="mt-2 text-sm text-gray-400">Your funds are safe and ready to use.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/dashboard/settle"
              className="rounded-xl bg-veil-600 px-6 py-3 font-medium text-white hover:bg-veil-500"
            >
              Pay a publisher
            </Link>
            <Link
              href="/dashboard/wallet"
              className="hairline rounded-xl bg-ink-900/60 px-6 py-3 text-sm text-gray-300 hover:text-white"
            >
              View wallet
            </Link>
          </div>
        </div>
        <Image
          src="/brand/hero-home.png"
          alt=""
          width={640}
          height={320}
          priority
          className="pointer-events-none absolute -right-4 top-1/2 hidden w-[48%] max-w-2xl -translate-y-1/2 object-contain opacity-90 lg:block"
        />
      </section>

      {/* Total balance */}
      <section className="hairline rounded-2xl bg-ink-900/60 p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Total balance
            </p>
            <p className="mt-1 text-3xl font-bold text-white sm:text-4xl">
              {xlm ? Number(xlm.amount).toLocaleString(undefined, { maximumFractionDigits: 7 }) : '—'}{' '}
              <span className="text-veil-400">XLM</span>
            </p>
          </div>
          <div className="flex gap-8">
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
        </div>
      </section>

      {/* Active pools + Recent activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Active pools</h2>
            <Link href="/dashboard/settle" className="text-xs text-veil-400 hover:underline">
              Pay →
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            {DENOMINATIONS.map((d) => {
              const c = counts?.[d.poolId];
              const pct = c != null && totalDeposits > 0 ? Math.round((c / totalDeposits) * 100) : null;
              const accent = POOL_ACCENT[d.poolId] ?? POOL_ACCENT_DEFAULT;
              return (
                <div key={d.poolId} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent.bg} ${accent.text}`}>
                      ◈
                    </span>
                    <span>
                      <span className={`block font-medium ${accent.text}`}>{d.label} pool</span>
                      <span className="mono flex items-center gap-1 text-xs text-gray-500">
                        {truncate(d.poolId, 6, 5)}
                        <ExplorerLink kind="contract" id={d.poolId}>↗</ExplorerLink>
                      </span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm text-gray-200">
                      {c == null ? '—' : `${c} deposit${c === 1 ? '' : 's'}`}
                    </span>
                    {pct != null && <span className={`text-xs ${accent.text}`}>{pct}%</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Recent activity</h2>
            <Link href="/dashboard/history" className="text-xs text-veil-400 hover:underline">
              View all →
            </Link>
          </div>
          <div className="mt-4">
            <TxLog address={address} limit={3} compact />
          </div>
        </Card>
      </div>

      {/* Quick actions — all route to real, existing screens */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-veil-400">Quick actions</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <QuickAction href="/dashboard/settle" icon="◈" label="Pay a publisher" />
          <QuickAction href="/dashboard/settle" icon="↓" label="Deposit to pool" />
          <QuickAction href="/dashboard/settle" icon="⇄" label="Withdraw from pool" />
          <QuickAction
            href={`https://stellar.expert/explorer/testnet/contract/${DENOMINATIONS[0].poolId}`}
            icon="⬚"
            label="View on-chain pools"
            external
          />
        </div>
      </section>

      {/* Trust note */}
      <p className="hairline flex items-center gap-3 rounded-2xl bg-ink-900/50 p-5 text-sm text-gray-400">
        <span className="text-lg text-amber-400">🛡</span>
        Your funds are always in your control. VeilGate never takes custody of your assets.
      </p>

      {/* On-chain proof + use cases (credibility content, below the ref fold) */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-veil-400">
          Proof it works on-chain
        </h2>
        <div className="mt-3">
          <VerifiedOnchain />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-veil-400">
          What you can build
        </h2>
        <div className="mt-3">
          <UseCases />
        </div>
      </section>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: string;
  label: string;
  external?: boolean;
}) {
  const cls =
    'hairline flex flex-col gap-3 rounded-xl bg-ink-900/60 p-4 text-sm text-gray-300 transition hover:bg-ink-900/90 hover:text-white';
  const inner = (
    <>
      <span
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-veil-900/60 text-veil-300"
        aria-hidden
      >
        {icon}
      </span>
      {label}
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer noopener" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
