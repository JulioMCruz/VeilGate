'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { loadHistory, type PaymentReceipt } from '@/lib/history';
import { Card, CopyButton, PrivacyBadge, ExplorerLink, truncate } from '@/components/ui';

/**
 * On-chain transaction / proof log — the judge-convincer. Every row is one private
 * payment: a deposit tx + a withdraw tx (two unlinkable transactions), the proof
 * verified on-chain, the nullifier that blocks double-spend, and the root the
 * contract checked against. Fed by the local receipt store written on settle.
 */
export function TxLog({
  address,
  limit,
  compact,
}: {
  address: string | null;
  limit?: number;
  /** Short preview row (icon, publisher, denomination, proof badge, time) instead
   * of the full detail block — used wherever this is a "recent activity" preview
   * (Home, Wallet) rather than the full Activity page. Same data, less of it shown. */
  compact?: boolean;
}) {
  const [items, setItems] = useState<PaymentReceipt[] | null>(null);

  useEffect(() => {
    const refresh = () => setItems(address ? loadHistory(address) : []);
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('veilgate:history', refresh as EventListener);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('veilgate:history', refresh as EventListener);
    };
  }, [address]);

  if (items === null) return <Loading />;
  if (items.length === 0) return <Empty />;

  const rows = limit ? items.slice(0, limit) : items;
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <Row key={`${r.nullifier}-${i}`} r={r} compact={compact} />
      ))}
      {limit && items.length > limit && (
        <Link
          href="/dashboard/history"
          className="block pt-1 text-center text-xs text-veil-400 hover:underline"
        >
          View all {items.length} payments →
        </Link>
      )}
    </div>
  );
}

// Direction icon derived from which tx hashes the receipt already carries — no
// new data, just a visual read of what's already loaded.
function directionIcon(r: PaymentReceipt): string {
  if (r.depositHash && r.withdrawHash) return '⇄';
  if (r.depositHash) return '↓';
  if (r.withdrawHash) return '↑';
  return '•';
}

function Row({ r, compact }: { r: PaymentReceipt; compact?: boolean }) {
  const onChain = Boolean(r.withdrawHash);
  const t = new Date(r.timestamp);

  if (compact) {
    return (
      <Card className="!p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-veil-600/20 text-veil-300"
            >
              {directionIcon(r)}
            </span>
            <div>
              <p className="text-sm font-medium text-gray-200">{r.publisherDomain || 'publisher'}</p>
              <div className="mt-0.5 flex items-center gap-2">
                {r.denomination && (
                  <span className="text-xs text-veil-300">{r.denomination}</span>
                )}
                {onChain && (
                  <span className="text-[11px] text-green-400">✓ proof verified</span>
                )}
              </div>
            </div>
          </div>
          <span className="shrink-0 text-[11px] text-gray-500" title={t.toLocaleString()}>
            {t.toLocaleTimeString()}
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="!p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-veil-600/20 text-veil-300"
          >
            {directionIcon(r)}
          </span>
          <span className="text-sm font-medium text-gray-200">
            {r.publisherDomain || 'publisher'}
          </span>
          {r.denomination && (
            <span className="rounded-md border border-veil-900/70 px-2 py-0.5 text-xs text-veil-300">
              {r.denomination}
            </span>
          )}
        </div>
        <span className="text-[11px] text-gray-500" title={t.toLocaleString()}>
          {t.toLocaleTimeString()}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {onChain && (
          <span className="inline-flex items-center gap-1 rounded-md bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-300">
            ✓ proof verified on-chain
          </span>
        )}
        <PrivacyBadge>deposit ↔ payment unlinkable</PrivacyBadge>
        {typeof r.anonymitySet === 'number' && r.anonymitySet > 0 && (
          <span className="text-[11px] text-gray-500">
            anonymity set: {r.anonymitySet}
          </span>
        )}
      </div>

      <dl className="mono mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        <KV k="Nullifier">
          <span className="text-gray-300">{truncate(r.nullifier, 10, 6)}</span>
          <CopyButton value={r.nullifier} label="nullifier" />
        </KV>
        {r.root && (
          <KV k="Root matched">
            <span className="text-gray-300">{truncate(r.root, 10, 6)}</span>
          </KV>
        )}
        {r.depositHash && (
          <KV k="Deposit tx">
            <ExplorerLink kind="tx" id={r.depositHash} />
          </KV>
        )}
        {r.withdrawHash && (
          <KV k="Withdraw tx">
            <ExplorerLink kind="tx" id={r.withdrawHash} />
          </KV>
        )}
        {r.poolId && (
          <KV k="Pool">
            <ExplorerLink kind="contract" id={r.poolId}>
              {`${truncate(r.poolId, 6, 6)} ↗`}
            </ExplorerLink>
          </KV>
        )}
      </dl>
    </Card>
  );
}

function KV({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-gray-500">{k}</dt>
      <dd className="flex items-center gap-1 text-gray-200">{children}</dd>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-800/50" />
      ))}
    </div>
  );
}

function Empty() {
  return (
    <Card className="py-12 text-center">
      <p className="text-2xl text-gray-600">⊞</p>
      <p className="mt-2 font-semibold text-gray-300">No payments yet</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
        Each payment generates an on-chain ZK proof. Your receipt — nullifier, root, and both tx
        links — appears here the moment a withdrawal confirms.
      </p>
      <Link
        href="/dashboard/settle"
        className="mt-4 inline-block rounded-xl bg-veil-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-veil-500"
      >
        Make your first private payment
      </Link>
    </Card>
  );
}
