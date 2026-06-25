'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useWallet } from '@/lib/providers/wallet-provider';
import { DENOMINATIONS } from '@/lib/pool-config';
import { Card, CopyButton, PrivacyBadge, ExplorerLink, TestnetPill, truncate } from '@/components/ui';
import { TxLog } from '@/components/tx-log';
import { UseCases } from '@/components/use-cases';

export function DashboardHome() {
  const { address } = useWallet();

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section className="text-center">
        <h1 className="text-3xl font-bold">Pay anything. Prove nothing.</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-gray-400">
          A fixed-denomination shielded pool on Stellar Testnet. Your deposit and your payment
          can&apos;t be linked on-chain — and the publisher never learns your wallet.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link
            href="/dashboard/settle"
            className="rounded-xl bg-veil-600 px-6 py-3 font-medium text-white hover:bg-veil-500"
          >
            Pay a publisher
          </Link>
          <TestnetPill />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-veil-400">How it works</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StepCard n="1" icon="◈" title="Deposit">
            Choose 0.1, 1, or 10 XLM. One Freighter transaction locks your funds into the
            fixed-denomination pool.
          </StepCard>
          <StepCard n="2" icon="⬡" title="Prove — in your browser">
            Your browser generates a Groth16 proof that your note is in the pool. The note secret
            never leaves this tab.
          </StepCard>
          <StepCard n="3" icon="⇄" title="Withdraw & pay">
            The contract verifies the proof on-chain and pays the publisher.{' '}
            <PrivacyBadge>unlinkable</PrivacyBadge>
          </StepCard>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-veil-400">
          Active pools — Stellar Testnet
        </h2>
        <div className="mt-3 space-y-2">
          {DENOMINATIONS.map((d) => (
            <Card key={d.poolId} className="!flex !p-4 items-center justify-between gap-3">
              <span className="text-lg font-bold text-veil-300">{d.label}</span>
              <span className="mono flex items-center gap-1 text-xs text-gray-400">
                {truncate(d.poolId, 6, 6)}
                <CopyButton value={d.poolId} label="pool ID" />
              </span>
              <ExplorerLink kind="contract" id={d.poolId}>
                View on-chain →
              </ExplorerLink>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-veil-400">
            Recent payments
          </h2>
          <Link href="/dashboard/history" className="text-xs text-veil-400 hover:underline">
            View all →
          </Link>
        </div>
        <div className="mt-3">
          <TxLog address={address} limit={3} />
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

function StepCard({
  n,
  icon,
  title,
  children,
}: {
  n: string;
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-veil-900/60 text-veil-300">
          {icon}
        </span>
        <span className="text-xs font-semibold text-veil-400">Step {n}</span>
      </div>
      <p className="mt-2 font-semibold text-gray-200">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-gray-400">{children}</p>
    </Card>
  );
}
