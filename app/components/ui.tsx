'use client';

import { useState, type ReactNode } from 'react';
import { useWallet } from '@/lib/providers/wallet-provider';

/** Truncate a hex/address string in the middle. */
export function truncate(s: string, head = 6, tail = 4): string {
  if (!s) return '';
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/** Inline badge for the privacy property: the deposit and the payment are unlinkable. */
export function PrivacyBadge({ children = 'unlinkable' }: { children?: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-veil-100 px-2 py-0.5 text-xs font-medium text-veil-700 dark:bg-veil-900/60 dark:text-veil-300"
      aria-label="Deposit and payment are unlinkable on-chain"
    >
      🔗 {children}
    </span>
  );
}

/** Link to stellar.expert (testnet) for a transaction or a contract. */
export function ExplorerLink({
  kind,
  id,
  children,
}: {
  kind: 'tx' | 'contract';
  id: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={`https://stellar.expert/explorer/testnet/${kind}/${id}`}
      target="_blank"
      rel="noreferrer noopener"
      className="text-veil-400 hover:underline"
    >
      {children ?? `${truncate(id, 8, 6)} ↗`}
    </a>
  );
}

export function AdvancedBadge() {
  return (
    <span className="rounded-md border border-veil-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-veil-500">
      Advanced
    </span>
  );
}

export function TestnetPill() {
  return (
    <span
      role="status"
      aria-label="Running on Stellar Testnet"
      title="You are on Stellar Testnet. Tokens here have no real value; contracts are not audited."
      className="rounded-full border border-amber-400/60 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
    >
      ● Testnet
    </span>
  );
}

/**
 * Pill that reflects the connected wallet's ACTUAL network (#4). Amber when on
 * (or defaulting to) Test Net; red when the wallet is on a different network so
 * the mismatch is obvious right next to the address.
 */
export function NetworkPill() {
  const { network, isConnected } = useWallet();
  const onTestnet = !isConnected || !network || network === 'TESTNET';
  const label = !isConnected
    ? 'Testnet'
    : network === 'TESTNET'
      ? 'Testnet'
      : network === 'PUBLIC'
        ? 'Main Net'
        : network ?? 'Unknown';

  if (onTestnet) {
    return (
      <span
        role="status"
        aria-label="Wallet on Stellar Testnet"
        title="On Stellar Testnet. Tokens here have no real value; contracts are not audited."
        className="rounded-full border border-amber-400/60 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      >
        ● {label}
      </span>
    );
  }
  return (
    <span
      role="status"
      aria-label={`Wallet on ${label} — switch Freighter to Test Net`}
      title="Your wallet is not on Test Net. Switch Freighter to Test Net to use VeilGate."
      className="rounded-full border border-red-500/60 bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"
    >
      ● {label}
    </span>
  );
}

/** Copy-to-clipboard button with transient "Copied!" feedback. */
export function CopyButton({ value, label = 'value' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      onClick={copy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className="rounded-md px-1.5 py-0.5 text-xs text-veil-500 hover:bg-veil-100 dark:hover:bg-veil-900/60"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

/**
 * Standardized tooltip for ZK terms. Plain on top, keyboard accessible.
 * Click/focus toggles (works on touch too).
 */
export function ZkTooltip({ term, children }: { term: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        aria-label={`What is ${term}?`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-veil-300 text-[10px] text-veil-500 hover:bg-veil-100 dark:border-veil-700 dark:hover:bg-veil-900/60"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-6 z-30 w-64 rounded-lg border border-veil-200 bg-white p-3 text-xs leading-relaxed text-gray-600 shadow-xl dark:border-veil-800 dark:bg-gray-900 dark:text-gray-300"
        >
          {children}
        </span>
      )}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-veil-100 bg-white p-6 shadow-sm dark:border-veil-900/70 dark:bg-gray-900/60 ${className}`}
    >
      {children}
    </div>
  );
}
