'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/lib/providers/wallet-provider';
import { loadPending, type PendingNote } from '@/lib/pending';
import { retryWithdraw } from '@/lib/pool';
import { addReceipt } from '@/lib/history';
import { Card, truncate } from '@/components/ui';

/**
 * Lists deposits whose payout never completed (#9) and lets the user finish them.
 * The note is restored from local storage; retrying re-proves and pays via the
 * relayer with NO new deposit, so stranded funds are recoverable.
 */
export function PendingWithdraws() {
  const { address } = useWallet();
  const [pending, setPending] = useState<PendingNote[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setPending([]);
      return;
    }
    const refresh = () => setPending(loadPending(address));
    refresh();
    window.addEventListener('veilgate:pending', refresh);
    return () => window.removeEventListener('veilgate:pending', refresh);
  }, [address]);

  if (!address || pending.length === 0) return null;

  async function retry(p: PendingNote) {
    if (!address) return;
    setError(null);
    setBusyId(p.id);
    try {
      const res = await retryWithdraw(address, p);
      addReceipt(address, {
        nullifier: res.nullifierHash,
        commitment: '',
        contentUrl: '',
        publisherDomain: truncate(p.publisher, 6, 6),
        timestamp: new Date().toISOString(),
        proofBytes: res.proofBytes,
        depositHash: res.depositHash,
        withdrawHash: res.withdrawHash,
        poolId: res.poolId,
        root: res.root,
        denomination: p.denomLabel,
        anonymitySet: res.anonymitySet,
      });
      window.dispatchEvent(new Event('veilgate:history'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retry failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="mb-6 border-amber-500/40 bg-amber-950/20">
      <p className="text-sm font-semibold text-amber-300">Pending deposits</p>
      <p className="mt-1 text-xs text-gray-400">
        These deposits were made but the payout didn&apos;t complete. Your note is saved on
        this device — retry to finish the payment. No new deposit is made.
      </p>
      <div className="mt-3 space-y-2">
        {pending.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-900/40 bg-gray-900/60 px-3 py-2"
          >
            <div className="text-xs">
              <span className="text-gray-200">{p.denomLabel}</span>
              <span className="text-gray-500"> → {truncate(p.publisher, 4, 4)}</span>
              <span className="text-gray-600"> · {new Date(p.createdAt).toLocaleString()}</span>
            </div>
            <button
              onClick={() => retry(p)}
              disabled={busyId !== null}
              className="rounded-lg bg-veil-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-veil-500 disabled:opacity-50"
            >
              {busyId === p.id ? 'Retrying…' : 'Retry payout'}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </Card>
  );
}
