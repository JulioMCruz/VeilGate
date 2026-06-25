'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/providers/wallet-provider';
import { payPrivately } from '@/lib/pool';
import { DENOMINATIONS, DEFAULT_DENOMINATION, type Denomination } from '@/lib/pool-config';
import { Card, CopyButton, PrivacyBadge, truncate } from '@/components/ui';

type Stage = 'idle' | 'depositing' | 'proving' | 'paying' | 'done' | 'error';

function stageLabel(stage: Stage, denom: Denomination): string {
  switch (stage) {
    case 'depositing':
      return `Depositing ${denom.label} into the pool…`;
    case 'proving':
      return 'Rebuilding the tree & proving in your browser…';
    case 'paying':
      return 'Verifying on-chain & paying the publisher…';
    default:
      return '';
  }
}

interface Receipt {
  depositHash: string;
  withdrawHash: string;
  nullifier: string;
  publisher: string;
  amount: string;
}

export function SettleFlow() {
  const { address } = useWallet();
  const [publisher, setPublisher] = useState('');
  const [denom, setDenom] = useState<Denomination>(DEFAULT_DENOMINATION);
  const [stage, setStage] = useState<Stage>('idle');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = !['idle', 'done', 'error'].includes(stage);

  async function pay() {
    if (!address) return;
    if (!/^G[A-Z2-7]{55}$/.test(publisher)) {
      setError('Enter a valid Stellar account address (G…) for the publisher.');
      setStage('error');
      return;
    }
    setError(null);
    setReceipt(null);
    try {
      const res = await payPrivately(address, publisher, denom, (s) => setStage(s));
      setReceipt({
        depositHash: res.depositHash,
        withdrawHash: res.withdrawHash,
        nullifier: res.nullifierHash,
        publisher,
        amount: denom.label,
      });
      setStage('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Settlement failed');
      setStage('error');
    }
  }

  if (stage === 'done' && receipt) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 animate-ring-expand items-center justify-center rounded-full bg-green-600 text-2xl text-white">
          ✓
        </div>
        <h2 className="text-xl font-bold">Publisher paid — on testnet</h2>
        <p className="mt-2 text-sm text-gray-400">
          {receipt.amount} moved to the publisher through the shielded pool. The proof was verified
          on-chain; your deposit and the payment are unlinkable.
        </p>
        <Card className="mt-6 text-left">
          <dl className="mono space-y-2 text-xs">
            <Row k="Publisher" v={truncate(receipt.publisher, 6, 6)} />
            <Row k="Amount" v={receipt.amount} />
            <ReceiptLink k="Deposit tx" hash={receipt.depositHash} />
            <ReceiptLink k="Withdraw tx" hash={receipt.withdrawHash} />
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Nullifier</dt>
              <dd className="flex items-center gap-1 text-gray-200">
                {truncate(receipt.nullifier, 10, 6)}
                <CopyButton value={receipt.nullifier} label="nullifier" />
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Link to your deposit</dt>
              <dd>
                <PrivacyBadge>private</PrivacyBadge>
              </dd>
            </div>
          </dl>
        </Card>
        <button
          onClick={() => {
            setStage('idle');
            setReceipt(null);
          }}
          className="mt-5 rounded-xl border border-veil-900/70 px-6 py-3 text-sm text-gray-300 hover:bg-veil-900/40"
        >
          Pay another
        </button>
      </div>
    );
  }

  if (busy) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <div className="relative mx-auto mb-8 h-24 w-24">
          <div className="proof-glow absolute inset-0 animate-proof-pulse rounded-full" />
        </div>
        <h2 className="text-lg font-bold" tabIndex={-1}>
          {stageLabel(stage, denom)}
        </h2>
        <ol className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm">
          <Step done={['proving', 'paying'].includes(stage)} active={stage === 'depositing'}>
            Deposit {denom.label} (you sign)
          </Step>
          <Step done={['paying'].includes(stage)} active={stage === 'proving'}>
            Rebuild tree &amp; prove (browser)
          </Step>
          <Step done={false} active={stage === 'paying'}>
            Verify on-chain &amp; pay publisher
          </Step>
        </ol>
        <p className="mt-6 text-xs text-gray-500">
          Real testnet transactions — this takes ~20–40 seconds.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">Pay a publisher — real settlement</h1>
      <p className="mt-1 text-sm text-gray-400">
        A real {denom.label} payment on Stellar testnet, routed through the shielded pool. Your
        deposit and the payment can&apos;t be linked on-chain.
      </p>

      <Card className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-veil-400">
          Publisher address
        </p>
        <input
          value={publisher}
          onChange={(e) => setPublisher(e.target.value.trim())}
          placeholder="G…"
          className="mono mt-2 w-full rounded-lg border border-veil-900/70 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-veil-500 focus:outline-none"
        />
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-veil-400">
          Denomination
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {DENOMINATIONS.map((d) => (
            <button
              key={d.poolId}
              onClick={() => setDenom(d)}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                d.poolId === denom.poolId
                  ? 'border-veil-500 bg-veil-600/20 text-white'
                  : 'border-veil-900/70 text-gray-400 hover:bg-veil-900/40'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          Each denomination is its own pool — you blend in with deposits of the same size.
        </p>
        <dl className="mt-4 space-y-1.5 text-sm">
          <Row k="Amount" v={`${denom.label} (fixed denomination)`} />
          <Row k="Pool" v={truncate(denom.poolId, 6, 6)} />
          <Row k="Network" v="Stellar Testnet" />
        </dl>
        <button
          onClick={pay}
          className="mt-5 w-full rounded-xl bg-veil-600 px-6 py-3 font-medium text-white hover:bg-veil-500"
        >
          Deposit &amp; pay privately
        </button>
        <p className="mt-2 text-center text-[11px] text-gray-500">
          You&apos;ll sign two transactions in Freighter (deposit + withdraw).
        </p>
      </Card>

      {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-gray-200">{v}</dd>
    </div>
  );
}

function ReceiptLink({ k, hash }: { k: string; hash: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{k}</dt>
      <dd>
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-veil-400 hover:underline"
        >
          {truncate(hash, 8, 6)} →
        </a>
      </dd>
    </div>
  );
}

function Step({ done, active, children }: { done: boolean; active: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className={done ? 'text-veil-400' : active ? 'animate-proof-pulse text-amber-400' : 'text-gray-600'}>
        {done ? '✓' : active ? '▸' : '○'}
      </span>
      <span className={active || done ? 'text-gray-200' : 'text-gray-500'}>{children}</span>
    </li>
  );
}
