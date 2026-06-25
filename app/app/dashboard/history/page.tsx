'use client';

import { useWallet } from '@/lib/providers/wallet-provider';
import { TxLog } from '@/components/tx-log';

export default function HistoryPage() {
  const { address } = useWallet();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Transaction log</h1>

      <div
        role="note"
        className="mt-4 rounded-xl border border-veil-900/70 bg-veil-950/40 p-4 text-sm text-veil-200"
      >
        Each receipt is stored only in your browser. The on-chain record shows that a proof was
        spent — not who deposited or who received. Your deposit and the payment are unlinkable
        on-chain, even to VeilGate.
      </div>

      <div className="mt-6">
        <TxLog address={address} />
      </div>
    </div>
  );
}
