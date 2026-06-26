'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/lib/providers/wallet-provider';
import { payPrivately, countDeposits } from '@/lib/pool';
import { addReceipt } from '@/lib/history';
import { DENOMINATIONS, DEFAULT_DENOMINATION, type Denomination } from '@/lib/pool-config';
import { Card, CopyButton, PrivacyBadge, ExplorerLink, truncate } from '@/components/ui';
import { PendingWithdraws } from '@/components/pending-withdraws';

type Stage = 'idle' | 'depositing' | 'proving' | 'paying' | 'done' | 'error';

function stageLabel(stage: Stage, denom: Denomination): string {
  switch (stage) {
    case 'depositing':
      return `Depositing ${denom.label} into the pool…`;
    case 'proving':
      return 'Generating your Groth16 privacy proof locally…';
    case 'paying':
      return 'Verifying on-chain & paying the publisher…';
    default:
      return '';
  }
}

const PROGRESS: Record<Stage, number> = {
  idle: 0,
  depositing: 25,
  proving: 60,
  paying: 90,
  done: 100,
  error: 0,
};

interface Receipt {
  depositHash: string;
  withdrawHash: string;
  nullifier: string;
  publisher: string;
  amount: string;
  poolId: string;
  root: string;
  proofBytes: number;
  anonymitySet: number;
}

export function SettleFlow() {
  const { address, network } = useWallet();
  const wrongNetwork = !!network && network !== 'TESTNET';
  const [publisher, setPublisher] = useState('');
  const [denom, setDenom] = useState<Denomination>(DEFAULT_DENOMINATION);
  const [stage, setStage] = useState<Stage>('idle');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [poolSize, setPoolSize] = useState<number | null>(null);

  const busy = !['idle', 'done', 'error'].includes(stage);
  const publisherValid = /^G[A-Z2-7]{55}$/.test(publisher);

  // Anonymity-set indicator: how many deposits are already in the chosen pool.
  useEffect(() => {
    if (!address) return;
    let live = true;
    setPoolSize(null);
    countDeposits(denom.poolId, address)
      .then((n) => live && setPoolSize(n))
      .catch(() => live && setPoolSize(null));
    return () => {
      live = false;
    };
  }, [denom.poolId, address]);

  async function pay() {
    if (!address) return;
    if (!publisherValid) {
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
        poolId: res.poolId,
        root: res.root,
        proofBytes: res.proofBytes,
        anonymitySet: res.anonymitySet,
      });
      // Persist an on-chain receipt so it shows up in the transaction log.
      addReceipt(address, {
        nullifier: res.nullifierHash,
        commitment: '',
        contentUrl: '',
        publisherDomain: truncate(publisher, 6, 6),
        timestamp: new Date().toISOString(),
        proofBytes: res.proofBytes,
        depositHash: res.depositHash,
        withdrawHash: res.withdrawHash,
        poolId: res.poolId,
        root: res.root,
        denomination: denom.label,
        anonymitySet: res.anonymitySet,
      });
      window.dispatchEvent(new Event('veilgate:history'));
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
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-veil-500/50 bg-veil-900/40 px-3 py-1 text-xs text-veil-300">
          <span>◈</span> Groth16 proof verified on-chain
        </div>
        <h2 className="text-xl font-bold">Payment confirmed on Stellar Testnet</h2>
        <p className="mt-2 text-sm text-gray-400">
          {receipt.amount} sent through the shielded pool. The proof was verified by the contract
          on-chain. Your deposit and this payment are unlinkable — no observer can connect them.
        </p>
        <Card className="mt-6 text-left">
          <dl className="mono space-y-2 text-xs">
            <Row k="Publisher" v={truncate(receipt.publisher, 6, 6)} />
            <Row k="Denomination" v={receipt.amount} />
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Deposit tx</dt>
              <dd><ExplorerLink kind="tx" id={receipt.depositHash} /></dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Withdraw tx</dt>
              <dd><ExplorerLink kind="tx" id={receipt.withdrawHash} /></dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Pool</dt>
              <dd><ExplorerLink kind="contract" id={receipt.poolId}>{`${truncate(receipt.poolId, 6, 6)} ↗`}</ExplorerLink></dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Nullifier</dt>
              <dd className="flex items-center gap-1 text-gray-200">
                {truncate(receipt.nullifier, 10, 6)}
                <CopyButton value={receipt.nullifier} label="nullifier" />
              </dd>
            </div>
            <Row k="Root matched" v={truncate(receipt.root, 10, 6)} />
            <Row k="Proof size" v={`${receipt.proofBytes} bytes`} />
            <Row k="Anonymity set" v={`${receipt.anonymitySet} deposit${receipt.anonymitySet === 1 ? '' : 's'}`} />
            <div className="flex items-center justify-between border-t border-veil-900/60 pt-2">
              <dt className="text-gray-500">Deposit ↔ payment</dt>
              <dd><PrivacyBadge>unlinkable</PrivacyBadge></dd>
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
          New private payment
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
        <div className="mx-auto mt-5 h-1 w-full max-w-xs rounded-full bg-veil-900/60">
          <div
            className="h-1 rounded-full bg-veil-500 transition-all duration-700"
            style={{ width: `${PROGRESS[stage]}%` }}
          />
        </div>
        <ol className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm">
          <Step done={['proving', 'paying'].includes(stage)} active={stage === 'depositing'}>
            Deposit {denom.label} (you sign)
          </Step>
          <Step done={['paying'].includes(stage)} active={stage === 'proving'}>
            Prove in your browser (Groth16)
          </Step>
          <Step done={false} active={stage === 'paying'}>
            Verify on-chain &amp; pay publisher
          </Step>
        </ol>
        <p className="mt-6 text-xs text-gray-500">
          Real Stellar Testnet — takes ~20–40&nbsp;s. Your note secret never leaves this tab.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <PendingWithdraws />
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
          {poolSize !== null && (
            <span className="text-veil-300">
              {' '}
              {poolSize} deposit{poolSize === 1 ? '' : 's'} in this pool — your payment blends in with all of them.
            </span>
          )}
        </p>
        <dl className="mt-4 space-y-1.5 text-sm">
          <Row k="Amount" v={`${denom.label} (fixed denomination)`} />
          <div className="flex items-center justify-between">
            <dt className="text-gray-500">Pool contract</dt>
            <dd className="mono flex items-center gap-1 text-gray-200">
              {truncate(denom.poolId, 6, 6)}
              <CopyButton value={denom.poolId} label="pool ID" />
              <ExplorerLink kind="contract" id={denom.poolId}>↗</ExplorerLink>
            </dd>
          </div>
          <Row k="Network" v="Stellar Testnet" />
        </dl>
        {wrongNetwork && (
          <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
            Your wallet is on <span className="mono">{network}</span>. Switch Freighter to
            <span className="mono"> Test Net</span> to make a payment.
          </p>
        )}
        <button
          onClick={pay}
          disabled={!publisherValid || wrongNetwork}
          className="mt-5 w-full rounded-xl bg-veil-600 px-6 py-3 font-medium text-white hover:bg-veil-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Deposit &amp; pay privately
        </button>
        <p className="mt-2 text-center text-[11px] text-gray-500">
          You&apos;ll sign one transaction in Freighter (the deposit). The payout is
          submitted by a relayer, so it can&apos;t be linked to you on-chain.
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
