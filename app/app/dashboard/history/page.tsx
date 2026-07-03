'use client';

import Image from 'next/image';
import { useWallet } from '@/lib/providers/wallet-provider';
import { ActivityLog } from '@/components/activity-log';

export default function HistoryPage() {
  const { address } = useWallet();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Activity</h1>
      <p className="mt-1 text-sm text-gray-400">Transaction log</p>

      <div className="hairline relative mt-4 overflow-hidden rounded-2xl bg-ink-900/60 p-6">
        <div className="relative z-10 flex max-w-md items-start gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-veil-600/20 text-veil-300"
          >
            ⊞
          </span>
          <p className="text-sm text-veil-100">
            Every action leaves a proof in your browser. The on-chain record proves that a payment
            was made and the settlement is final. Your deposit and the payment are{' '}
            <span className="font-semibold text-veil-300">unlinkable on-chain</span>, even to the
            VeilGate operator.
          </p>
        </div>
        <Image
          src="/brand/hero-home.png"
          alt=""
          width={480}
          height={240}
          className="pointer-events-none absolute -right-6 top-1/2 hidden w-[38%] max-w-md -translate-y-1/2 object-contain opacity-90 lg:block"
        />
      </div>

      <div className="mt-6">
        <ActivityLog address={address} />
      </div>
    </div>
  );
}
