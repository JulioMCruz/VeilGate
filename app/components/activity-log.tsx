'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadHistory, type PaymentReceipt } from '@/lib/history';
import { Card, CopyButton, PrivacyBadge, ExplorerLink, truncate } from '@/components/ui';

/**
 * Full Activity page log — search, filter, date range, export, pagination, and
 * expandable rows, matching `activity page ref.png`. Separate from `TxLog`
 * (used as a small "recent activity" preview on Home/Wallet) so that component
 * and its tests stay untouched. Reads the same `loadHistory()` store; every
 * filter/derived value below comes from data already on the receipt — nothing
 * invented (e.g. "type" is derived from which tx hashes are present, the same
 * logic that already drives the direction icon).
 */

type TypeFilter = 'all' | 'deposit' | 'withdraw' | 'payment';

function typeOf(r: PaymentReceipt): 'deposit' | 'withdraw' | 'payment' {
  if (r.depositHash && r.withdrawHash) return 'payment';
  if (r.depositHash) return 'deposit';
  return 'withdraw';
}

function directionIcon(r: PaymentReceipt): string {
  const t = typeOf(r);
  return t === 'payment' ? '⇄' : t === 'deposit' ? '↓' : '↑';
}

const PAGE_SIZE = 5;

export function ActivityLog({ address }: { address: string | null }) {
  const [items, setItems] = useState<PaymentReceipt[] | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const refresh = () => {
      const list = address ? loadHistory(address) : [];
      setItems(list);
      // Expanded by default, matching the reference screenshot.
      setExpanded(new Set(list.map((r, i) => `${r.nullifier}-${i}`)));
    };
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('veilgate:history', refresh as EventListener);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('veilgate:history', refresh as EventListener);
    };
  }, [address]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    // end-of-day so the "to" date is inclusive
    const to = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    return items.filter((r) => {
      if (typeFilter !== 'all' && typeOf(r) !== typeFilter) return false;
      const t = new Date(r.timestamp).getTime();
      if (from !== null && t < from) return false;
      if (to !== null && t > to) return false;
      if (q) {
        const haystack = [
          r.nullifier,
          r.poolId,
          r.denomination,
          r.publisherDomain,
          r.depositHash,
          r.withdrawHash,
          r.root,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, typeFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter, dateFrom, dateTo]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const header = [
      'timestamp',
      'type',
      'denomination',
      'publisher',
      'nullifier',
      'root',
      'depositTx',
      'withdrawTx',
      'poolId',
      'anonymitySet',
      'proofBytes',
    ];
    const rows = filtered.map((r) => [
      r.timestamp,
      typeOf(r),
      r.denomination ?? '',
      r.publisherDomain ?? '',
      r.nullifier,
      r.root ?? '',
      r.depositHash ?? '',
      r.withdrawHash ?? '',
      r.poolId ?? '',
      r.anonymitySet ?? '',
      r.proofBytes ?? '',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veilgate-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (items === null) return <Loading />;
  if (items.length === 0) return <Empty />;

  return (
    <div>
      {/* Search + filters + export */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by tx hash, pool, amount…"
          className="hairline w-full rounded-xl bg-ink-900/60 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-veil-500 focus:outline-none sm:min-w-[220px] sm:w-auto sm:flex-1"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="hairline rounded-xl bg-ink-900/60 px-3 py-2 text-sm text-gray-200 focus:outline-none"
        >
          <option value="all">All types</option>
          <option value="deposit">Deposit</option>
          <option value="withdraw">Withdraw</option>
          <option value="payment">Payment</option>
        </select>
        <div className="flex min-w-0 items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="hairline min-w-0 flex-1 rounded-xl bg-ink-900/60 px-3 py-2 text-sm text-gray-200 focus:outline-none"
            aria-label="From date"
          />
          <span className="shrink-0 text-gray-600">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="hairline min-w-0 flex-1 rounded-xl bg-ink-900/60 px-3 py-2 text-sm text-gray-200 focus:outline-none"
            aria-label="To date"
          />
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="hairline flex items-center gap-2 rounded-xl bg-ink-900/60 px-4 py-2 text-sm text-gray-200 transition hover:bg-ink-900/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ⬇ Export
        </button>
      </div>

      {/* Rows */}
      <div className="mt-4 space-y-2">
        {pageItems.length === 0 ? (
          <Card className="py-10 text-center text-sm text-gray-500">
            No activity matches these filters.
          </Card>
        ) : (
          pageItems.map((r, i) => {
            const id = `${r.nullifier}-${(page - 1) * PAGE_SIZE + i}`;
            return <Row key={id} r={r} isOpen={expanded.has(id)} onToggle={() => toggle(id)} />;
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg px-2 py-1.5 text-gray-400 hover:bg-ink-900/60 disabled:opacity-30"
            aria-label="Previous page"
          >
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`h-8 w-8 rounded-lg text-sm ${
                n === page ? 'bg-veil-600 text-white' : 'text-gray-400 hover:bg-ink-900/60'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg px-2 py-1.5 text-gray-400 hover:bg-ink-900/60 disabled:opacity-30"
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ r, isOpen, onToggle }: { r: PaymentReceipt; isOpen: boolean; onToggle: () => void }) {
  const onChain = Boolean(r.withdrawHash);
  const t = new Date(r.timestamp);
  const type = typeOf(r);

  return (
    <Card className="!p-4">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-veil-600 text-white"
          >
            {directionIcon(r)}
          </span>
          <div>
            <span className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-100">{r.publisherDomain || 'publisher'}</span>
              {r.denomination && (
                <span className="rounded-md border border-veil-900/70 px-2 py-0.5 text-xs text-veil-300">
                  {r.denomination}
                </span>
              )}
            </span>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {onChain && (
                <span className="inline-flex items-center gap-1 rounded-md bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-300">
                  ✓ Proof verified on-chain
                </span>
              )}
              <PrivacyBadge>
                {type === 'payment' ? 'Deposit → payment unlinkable' : 'unlinkable'}
              </PrivacyBadge>
              {typeof r.anonymitySet === 'number' && r.anonymitySet > 0 && (
                <span className="text-[11px] text-gray-500">anonymity set: {r.anonymitySet}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-500" title={t.toLocaleString()}>
            {t.toLocaleTimeString()}
          </span>
          <span className={`text-gray-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} aria-hidden>
            ›
          </span>
        </div>
      </button>

      {isOpen && (
        <dl className="mono mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-veil-900/50 pt-3 text-xs sm:grid-cols-4">
          <KV k="Type">
            <span className="text-gray-300 capitalize">{type}</span>
          </KV>
          {r.poolId && (
            <KV k="Pool">
              <ExplorerLink kind="contract" id={r.poolId}>
                {`${truncate(r.poolId, 6, 5)} ↗`}
              </ExplorerLink>
            </KV>
          )}
          <KV k="Network">
            <span className="text-gray-300">Stellar Testnet</span>
          </KV>
          <KV k="Nullifier">
            <span className="text-gray-300">{truncate(r.nullifier, 8, 5)}</span>
            <CopyButton value={r.nullifier} label="nullifier" />
          </KV>
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
          {r.root && (
            <KV k="Root matched">
              <span className="text-gray-300">{truncate(r.root, 8, 5)}</span>
            </KV>
          )}
        </dl>
      )}
    </Card>
  );
}

function KV({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-gray-500">{k}</dt>
      <dd className="mt-0.5 flex items-center gap-1 text-gray-200">{children}</dd>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-800/50" />
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
        Each payment generates an on-chain ZK proof. Your receipt appears here the moment a
        withdrawal confirms.
      </p>
    </Card>
  );
}
