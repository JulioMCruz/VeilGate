'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useWallet } from '@/lib/providers/wallet-provider';
import { loadHistory, type PaymentReceipt } from '@/lib/history';
import { Card, CopyButton, PrivacyBadge, ZkTooltip, truncate } from '@/components/ui';

export default function HistoryPage() {
  const { address } = useWallet();
  const [items, setItems] = useState<PaymentReceipt[]>([]);

  useEffect(() => {
    if (address) setItems(loadHistory(address));
  }, [address]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Payment history</h1>

      <div
        role="note"
        className="mt-4 rounded-xl border border-veil-900/70 bg-veil-950/40 p-4 text-sm text-veil-200"
      >
        Amounts are never recorded — this is a privacy feature, not a limitation. Each
        receipt proves you paid without revealing how much. VeilGate itself cannot see your
        amounts.
      </div>

      {items.length === 0 ? (
        <Card className="mt-6 text-center">
          <h2 className="font-semibold">No payments yet</h2>
          <p className="mt-1 text-sm text-gray-400">
            When you pay for an article, a proof receipt will appear here. Amounts are never
            stored — only proof that you paid.
          </p>
          <Link
            href="/dashboard/pay"
            className="mt-4 inline-block rounded-xl bg-veil-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-veil-500"
          >
            Pay for your first article
          </Link>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((r, i) => (
            <Card key={i}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-100">{r.publisherDomain}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(r.timestamp).toLocaleString()}
                  </p>
                </div>
                <a
                  href={r.contentUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs text-veil-400 hover:underline"
                >
                  Re-read →
                </a>
              </div>
              <div className="mono mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  Nullifier {truncate(r.nullifier, 10, 6)}
                  <CopyButton value={r.nullifier} label="nullifier" />
                  <ZkTooltip term="nullifier">
                    A one-time code generated from your payment. It stops the same proof from
                    being used twice and ties it to a specific publisher — so it cannot be
                    replayed elsewhere. It tells no one what you paid.
                  </ZkTooltip>
                </span>
                <span className="flex items-center gap-1">
                  Amount <PrivacyBadge />
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
