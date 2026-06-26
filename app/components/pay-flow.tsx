'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/providers/wallet-provider';
import {
  generatePaymentProof,
  verifyPaymentProof,
  type ProofPhase,
} from '@/lib/proof';
import type { UltraHonkProof } from '@/lib/types';
import { addReceipt, domainOf, type PaymentReceipt } from '@/lib/history';
import { Card, CopyButton, PrivacyBadge, ZkTooltip, truncate } from '@/components/ui';

type Stage = 'idle' | 'proving' | 'verifying' | 'unlocked' | 'error';

interface LogEntry {
  label: string;
  annotation: string;
  status: 'pending' | 'active' | 'done';
}

const PHASE_LOG: Record<ProofPhase, { label: string; annotation: string }> = {
  inputs: { label: 'Computing commitment + nullifier', annotation: 'Hashes your private inputs' },
  witness: { label: 'Solving the circuit witness', annotation: 'Checks every constraint holds' },
  proving: { label: 'Running UltraHonk circuit', annotation: 'The slow part — pure math' },
  done: { label: 'Proof generated', annotation: 'A certificate of “valid amount”' },
};
const PHASE_ORDER: ProofPhase[] = ['inputs', 'witness', 'proving', 'done'];

export function PayFlow({ initialUrl = '' }: { initialUrl?: string }) {
  const { address } = useWallet();
  const [stage, setStage] = useState<Stage>('idle');
  const [url, setUrl] = useState(initialUrl);
  const [amount, setAmount] = useState(128);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [error, setError] = useState<{ code: string; detail: string } | null>(null);

  function setPhase(phase: ProofPhase) {
    setLog(
      PHASE_ORDER.map((p) => ({
        ...PHASE_LOG[p],
        status:
          PHASE_ORDER.indexOf(p) < PHASE_ORDER.indexOf(phase)
            ? 'done'
            : p === phase
              ? phase === 'done'
                ? 'done'
                : 'active'
              : 'pending',
      }))
    );
  }

  async function handlePay() {
    if (!url.trim()) {
      setError({ code: 'NO_URL', detail: 'Enter a content URL first.' });
      setStage('error');
      return;
    }
    setError(null);
    setLog([]);
    setStage('proving');
    let bundle: UltraHonkProof;
    try {
      bundle = await generatePaymentProof(amount, undefined, setPhase);
    } catch (e) {
      setError({ code: 'PROOF_FAILED', detail: e instanceof Error ? e.message : String(e) });
      setStage('error');
      return;
    }
    setStage('verifying');
    try {
      const ok = await verifyPaymentProof(bundle);
      if (!ok) throw new Error('proof rejected');
    } catch (e) {
      setError({ code: 'VERIFY_FAILED', detail: e instanceof Error ? e.message : String(e) });
      setStage('error');
      return;
    }
    const r: PaymentReceipt = {
      nullifier: bundle.nullifierHash,
      commitment: bundle.commitment,
      contentUrl: url,
      publisherDomain: domainOf(url),
      timestamp: new Date().toISOString(),
      proofBytes: bundle.proof.length,
    };
    if (address) addReceipt(address, r);
    setReceipt(r);
    setStage('unlocked');
  }

  function reset() {
    setStage('idle');
    setReceipt(null);
    setError(null);
    setLog([]);
  }

  if (stage === 'proving' || stage === 'verifying') {
    return <ProvingView stage={stage} log={log} />;
  }
  if (stage === 'unlocked' && receipt) {
    return <UnlockedView receipt={receipt} onAgain={reset} />;
  }
  if (stage === 'error' && error) {
    return <ErrorView error={error} onRetry={reset} />;
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">Pay for content privately</h1>
      <p className="mt-1 text-sm text-gray-400">
        Enter the article URL and choose your amount. Your amount is kept on this device.
      </p>

      <Card className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-veil-400">
          Step 1 · Content URL
        </p>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://publisher.com/article-slug"
          className="mt-2 w-full rounded-lg border border-veil-900/70 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-veil-500 focus:outline-none"
        />
      </Card>

      <Card className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-veil-400">
          Step 2 · Your private amount
          <ZkTooltip term="zero-knowledge proof">
            A zero-knowledge proof lets you prove a fact (“my amount is valid”) without
            revealing the underlying number. VeilGate uses UltraHonk, run in your browser
            via WebAssembly.
          </ZkTooltip>
        </p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-veil-300">{amount}</span>
          <span className="text-sm text-gray-500">centi-cents</span>
        </div>
        <input
          type="range"
          min={1}
          max={255}
          value={amount}
          onChange={(e) => setAmount(parseInt(e.target.value, 10))}
          aria-label="Payment amount in centi-cents"
          aria-valuetext={`${amount} centi-cents`}
          className="mt-2 w-full accent-veil-500"
        />
        <p className="mt-2 text-xs text-gray-500">
          This number never leaves your browser. The proof only reveals that the amount is
          between 1 and 255 — nothing more.
        </p>
      </Card>

      <Card className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-veil-400">
          Step 3 · Review &amp; prove
        </p>
        <dl className="mt-3 space-y-1.5 text-sm">
          <Row k="Content">{url ? domainOf(url) : '—'}</Row>
          <Row k="Amount">
            <PrivacyBadge>stays on device</PrivacyBadge>
          </Row>
          <Row k="Network">Stellar Testnet</Row>
          <Row k="Network fee">~0.001 XLM</Row>
        </dl>
        <button
          onClick={handlePay}
          className="mt-5 w-full rounded-xl bg-veil-600 px-6 py-3 font-medium text-white hover:bg-veil-500"
        >
          Generate proof and pay
        </button>
      </Card>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-gray-200">{children}</dd>
    </div>
  );
}

function ProvingView({ stage, log }: { stage: 'proving' | 'verifying'; log: LogEntry[] }) {
  const steps = ['Hiding', 'Confirming', 'Unlocking'];
  const current = stage === 'proving' ? 0 : 1;
  return (
    <div className="mx-auto max-w-xl text-center">
      <div className="relative mx-auto mb-8 h-28 w-28">
        <div className="proof-glow absolute inset-0 animate-proof-pulse rounded-full" />
        <div className="absolute inset-6 rounded-full border-2 border-dashed border-veil-500/70" />
      </div>

      <StepIndicator steps={steps} current={current} />

      <h2 className="mt-6 text-xl font-bold" tabIndex={-1}>
        {stage === 'proving' ? 'Hiding your amount right now' : 'Confirming on Stellar'}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
        {stage === 'proving'
          ? 'Your browser is running a zero-knowledge proof. In a few seconds it will produce a certificate that says “valid amount” — without encoding the number itself. This takes 3–10 seconds.'
          : 'The proof is being verified. If valid, payment is confirmed without anyone learning your amount.'}
      </p>

      <div
        role="log"
        aria-live="polite"
        aria-label="Proof generation progress"
        className="mono mx-auto mt-6 w-full max-w-md space-y-1 rounded-xl border border-veil-900/70 bg-gray-950 p-4 text-left text-xs"
      >
        {log.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={e.status === 'done' ? 'text-veil-400' : e.status === 'active' ? 'text-amber-400' : 'text-gray-600'}>
              {e.status === 'done' ? '✓' : e.status === 'active' ? '▸' : '·'}
            </span>
            <span className={e.status === 'pending' ? 'text-gray-600' : 'text-gray-300'}>
              {e.label}
            </span>
            <span className="ml-auto hidden text-gray-600 sm:inline">{e.annotation}</span>
          </div>
        ))}
        {stage === 'verifying' && (
          <div className="flex items-center gap-2">
            <span className="text-amber-400">▸</span>
            <span className="text-gray-300">Verifying the proof</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuenow={current + 1}
      aria-label="Payment progress"
      className="flex items-center justify-center gap-2 text-xs"
    >
      {steps.map((s, i) => (
        <span key={s} className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              i < current ? 'bg-veil-400' : i === current ? 'animate-proof-pulse bg-veil-500' : 'bg-gray-700'
            }`}
          />
          <span className={i <= current ? 'text-veil-300' : 'text-gray-600'}>{s}</span>
          {i < steps.length - 1 && <span className="text-gray-700">→</span>}
        </span>
      ))}
    </div>
  );
}

function UnlockedView({ receipt, onAgain }: { receipt: PaymentReceipt; onAgain: () => void }) {
  const [reading, setReading] = useState(false);
  return (
    <div className="mx-auto max-w-xl text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 animate-ring-expand items-center justify-center rounded-full bg-veil-600 text-2xl text-white">
        ✓
      </div>
      <h2 className="text-xl font-bold">Article unlocked</h2>
      <p className="mt-2 text-sm text-gray-400">
        Your payment is complete. Your amount was never transmitted — only its proof was.
      </p>

      <Card className="mt-6 text-left">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-veil-400">
          Proof receipt — saved to history
        </p>
        <dl className="mono space-y-2 text-xs">
          <ReceiptRow k="Nullifier" v={receipt.nullifier} copy label="nullifier" />
          <ReceiptRow k="Commitment" v={receipt.commitment} copy label="commitment" />
          <div className="flex items-center justify-between gap-2">
            <dt className="text-gray-500">Content</dt>
            <dd className="text-gray-200">{receipt.publisherDomain}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-gray-500">Amount</dt>
            <dd>
              <PrivacyBadge>not recorded</PrivacyBadge>
            </dd>
          </div>
        </dl>
      </Card>

      <p className="mt-3 text-xs text-gray-500">
        Even if someone saw this receipt, they would not know what you paid. That is the point.
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          onClick={() => setReading(true)}
          className="rounded-xl bg-veil-600 px-6 py-3 text-sm font-medium text-white hover:bg-veil-500"
        >
          Read the article
        </button>
        <button
          onClick={onAgain}
          className="rounded-xl border border-veil-900/70 px-6 py-3 text-sm text-gray-300 hover:bg-veil-900/40"
        >
          Pay another
        </button>
      </div>

      {reading && (
        <Card className="mt-6 text-left">
          <p className="text-xs uppercase tracking-wide text-veil-400">{receipt.publisherDomain}</p>
          <h3 className="mt-1 text-lg font-bold">Premium Article (demo content)</h3>
          <p className="mt-2 text-sm text-gray-400">
            This is the unlocked premium content. In a real deployment the publisher’s
            gateway would release the article (or a bearer token) once it sees a valid
            proof and the recorded nullifier — without ever learning how much you paid.
          </p>
        </Card>
      )}
    </div>
  );
}

function ReceiptRow({ k, v, copy, label }: { k: string; v: string; copy?: boolean; label?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-gray-500">{k}</dt>
      <dd className="flex items-center gap-1 text-gray-200">
        {truncate(v, 10, 6)}
        {copy && <CopyButton value={v} label={label} />}
      </dd>
    </div>
  );
}

function ErrorView({ error, onRetry }: { error: { code: string; detail: string }; onRetry: () => void }) {
  const messages: Record<string, string> = {
    NO_URL: 'Enter the URL of the article you want to unlock.',
    PROOF_FAILED:
      'The proof could not be generated. Your amount was not submitted and no funds were moved. Try again.',
    VERIFY_FAILED:
      'The proof was generated but did not verify. Check the content URL and try again.',
  };
  return (
    <div className="mx-auto max-w-xl text-center">
      <h2 className="text-xl font-bold text-red-400" tabIndex={-1}>
        Something went wrong
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
        {messages[error.code] ?? 'An unexpected error occurred. No funds were moved.'}
      </p>
      <div className="mt-5">
        <button
          onClick={onRetry}
          className="rounded-xl bg-veil-600 px-6 py-3 text-sm font-medium text-white hover:bg-veil-500"
        >
          Try again
        </button>
      </div>
      <details className="mx-auto mt-4 max-w-md text-left">
        <summary className="cursor-pointer text-xs text-gray-500">Show error details</summary>
        <pre className="mono mt-2 overflow-x-auto rounded-lg border border-veil-900/70 bg-gray-950 p-3 text-[11px] text-gray-400">
          {error.code}: {error.detail}
        </pre>
      </details>
    </div>
  );
}
