'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useWallet } from '@/lib/providers/wallet-provider';
import { payPrivately, shieldDeposit, countDeposits } from '@/lib/pool';
import { addReceipt } from '@/lib/history';
import { DENOMINATIONS, DEFAULT_DENOMINATION, type Denomination } from '@/lib/pool-config';
import { Card, CopyButton, PrivacyBadge, ExplorerLink, truncate } from '@/components/ui';
import { PendingWithdraws } from '@/components/pending-withdraws';
import { HowItWorks } from '@/components/how-it-works';

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

// Minimum anonymity set (UNLINKABILITY-PLAN condition 3): below this, a payment is
// weakly anonymous, so we warn and require an explicit acknowledgment.
const K_MIN = 5;

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
  const [ackSmallSet, setAckSmallSet] = useState(false);
  const [shieldMsg, setShieldMsg] = useState<string | null>(null);
  const smallSet = poolSize !== null && poolSize < K_MIN;

  const busy = !['idle', 'done', 'error'].includes(stage);
  const publisherValid = /^G[A-Z2-7]{55}$/.test(publisher);

  // Anonymity-set indicator: how many deposits are already in the chosen pool.
  useEffect(() => {
    if (!address) return;
    let live = true;
    setPoolSize(null);
    setAckSmallSet(false);
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

  async function shield() {
    if (!address) return;
    if (!publisherValid) {
      setError('Enter a valid Stellar account address (G…) for the publisher.');
      setStage('error');
      return;
    }
    setError(null);
    setReceipt(null);
    setShieldMsg(null);
    try {
      setStage('depositing');
      await shieldDeposit(address, publisher, denom, (s) => setStage(s));
      setStage('idle');
      setShieldMsg(
        'Shielded — your note is deposited. Complete the payout anytime below; paying later ' +
          'decouples the deposit from the withdraw in time, making them even harder to link.'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Shield failed');
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
    <div className="mx-auto max-w-5xl">
      <PendingWithdraws />

      {/* Banner — same brand art as Home, mirroring the reference layout */}
      <div className="hairline relative overflow-hidden rounded-2xl bg-ink-900/60 p-8">
        <div className="relative z-10 max-w-lg">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white sm:text-display-sm">
            Pay a publisher — real settlement
            <span className="h-2 w-2 shrink-0 rounded-full bg-veil-400" aria-hidden />
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            A real {denom.label} payment on Stellar testnet, routed through the shielded pool. Your
            deposit and the payment can&apos;t be linked on-chain.
          </p>
        </div>
        <Image
          src="/brand/hero-home.png"
          alt=""
          width={640}
          height={320}
          className="pointer-events-none absolute -right-4 top-1/2 hidden w-[46%] max-w-xl -translate-y-1/2 object-contain opacity-90 lg:block"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-veil-400">
            Publisher address
            <InfoDot label="The publisher's Stellar account — the proof is bound to this exact address." />
          </p>
          <input
            value={publisher}
            onChange={(e) => setPublisher(e.target.value.trim())}
            placeholder="G…"
            className="mono mt-2 w-full rounded-lg border border-veil-900/70 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-veil-500 focus:outline-none"
          />
          <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-veil-400">
            Denomination
            <InfoDot label="Fixed amounts only — this is what keeps every payment in a pool indistinguishable from the rest." />
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {DENOMINATIONS.map((d) => {
              const selected = d.poolId === denom.poolId;
              return (
                <button
                  key={d.poolId}
                  onClick={() => setDenom(d)}
                  className={`relative rounded-lg border px-3 py-2 text-sm transition ${
                    selected
                      ? 'border-veil-500 bg-veil-600/20 text-white'
                      : 'border-veil-900/70 text-gray-400 hover:bg-veil-900/40'
                  }`}
                >
                  {selected && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-veil-500 text-[10px] text-white">
                      ✓
                    </span>
                  )}
                  {d.label}
                </button>
              );
            })}
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
          {smallSet && (
            <label className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
              <input
                type="checkbox"
                checked={ackSmallSet}
                onChange={(e) => setAckSmallSet(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Only {poolSize} deposit{poolSize === 1 ? '' : 's'} in this pool — fewer than {K_MIN},
                so anonymity is weak (an observer could narrow down the link). For real privacy, wait
                for more deposits or <strong>shield now and pay later</strong>. Proceed anyway?
              </span>
            </label>
          )}
          <button
            onClick={pay}
            disabled={!publisherValid || wrongNetwork || (smallSet && !ackSmallSet)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pulse-500 to-veil-600 px-6 py-3 font-medium text-white shadow-lg shadow-veil-900/40 transition hover:from-pulse-400 hover:to-veil-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Deposit &amp; pay now
            <span aria-hidden>🔒</span>
          </button>
          <button
            onClick={shield}
            disabled={!publisherValid || wrongNetwork}
            className="mt-2 w-full rounded-xl border border-veil-700 px-6 py-3 text-sm font-medium text-veil-200 hover:bg-veil-900/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Shield now, pay later (stronger privacy)
          </button>
          <p className="mt-2 text-center text-[11px] text-gray-500">
            You&apos;ll sign one transaction in Freighter (the deposit). The payout is submitted by a
            relayer, so it can&apos;t be linked to you on-chain. <strong>Shield</strong> deposits now
            and lets you pay later — decoupling the two in time makes them even harder to correlate.
          </p>

          {shieldMsg && (
            <p className="mt-4 rounded-lg border border-veil-500/40 bg-veil-900/40 px-3 py-2 text-sm text-veil-200">
              {shieldMsg}
            </p>
          )}
          {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
        </Card>

        <div className="space-y-4">
          <Card className="!p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-veil-400">
              Payment preview
              <InfoDot label="Exactly what will be submitted — the amount is the public denomination; who you're paying stays unlinkable." />
            </p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-2xl font-bold text-white">{denom.label}</p>
              <Image src="/brand/logo-mark.png" alt="" width={53} height={36} className="h-9 w-auto object-contain opacity-90" />
            </div>
            <dl className="mt-4 space-y-1.5 text-sm">
              <Row k="Denomination" v={denom.label} />
              <Row k="Pool" v={`${denom.label} pool`} />
              <Row k="Network" v="Stellar Testnet" />
              <Row k="Est. time" v="~5–10 sec" />
            </dl>
          </Card>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-veil-400">How it works</p>
            <div className="mt-2">
              <HowItWorks compact />
            </div>
          </div>
          <Card className="!p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-veil-400">
              Privacy by design
            </p>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <span className="text-veil-400" aria-hidden>◈</span> Zero-knowledge proofs
              </li>
              <li className="flex items-center gap-2">
                <span className="text-veil-400" aria-hidden>🔗</span> Unlinkable payments
              </li>
              <li className="flex items-center gap-2">
                <span className="text-veil-400" aria-hidden>⛓</span> No on-chain linkability
              </li>
              <li className="flex items-center gap-2">
                <span className="text-veil-400" aria-hidden>👁</span> Publisher never sees your wallet
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoDot({ label }: { label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-gray-600 text-[9px] normal-case text-gray-500"
    >
      i
    </span>
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
