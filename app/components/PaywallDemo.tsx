'use client';

import { useState } from 'react';
import { ConnectWallet } from './ConnectWallet';
import { generatePaymentProof, verifyPaymentProof } from '@/lib/proof';
import type { WalletAddress, PaymentReceipt } from '@/lib/types';

type Stage = 'idle' | 'proving' | 'verifying';

export function PaywallDemo() {
  const [wallet, setWallet] = useState<WalletAddress | null>(null);
  const [amount, setAmount] = useState(100); // centi-cents
  const [stage, setStage] = useState<Stage>('idle');
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paying = stage !== 'idle';

  async function handlePay() {
    if (!wallet) {
      setError('Connect wallet first');
      return;
    }
    setError(null);
    setReceipt(null);
    try {
      // 1. Generate a REAL UltraHonk proof in the browser. The amount stays
      //    private; only the public inputs (commitment, nullifier hash, …) leave.
      setStage('proving');
      const bundle = await generatePaymentProof(amount);

      // 2. Verify it client-side before unlocking.
      setStage('verifying');
      const ok = await verifyPaymentProof(bundle);
      if (!ok) throw new Error('proof failed to verify');

      const bearer = `vg_${bundle.nullifierHash.slice(2, 18)}`;
      setReceipt({
        nullifierHash: bundle.nullifierHash,
        proofBytes: bundle.proof.length,
        verified: ok,
        bearerToken: bearer,
        contentUrl: '/premium/content',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Proof generation failed');
    } finally {
      setStage('idle');
    }
  }

  if (!wallet) {
    return <ConnectWallet onConnect={setWallet} />;
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-veil-100 bg-white p-8 shadow-xl dark:bg-gray-900">
      <h2 className="text-xl font-semibold text-veil-600">Premium Article</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Hidden content (placeholder). After payment you will see the full text.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <label className="text-sm text-gray-700 dark:text-gray-300">
          Amount (centi-cents)
          <input
            type="number"
            min={1}
            max={255}
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-800 dark:text-white"
          />
        </label>
        <p className="text-xs text-gray-500">
          Connected: <span className="font-mono">{wallet.address.slice(0, 8)}...</span>
        </p>
        <button
          onClick={handlePay}
          disabled={paying}
          className="rounded-xl bg-veil-600 px-6 py-3 text-white shadow hover:bg-veil-500 transition disabled:opacity-50"
        >
          {stage === 'proving'
            ? 'Generating ZK proof…'
            : stage === 'verifying'
              ? 'Verifying proof…'
              : `Pay ${amount} centi-cents privately`}
        </button>
        <p className="text-center text-[11px] text-gray-400">
          A real UltraHonk proof is generated in your browser. The amount never leaves the device.
        </p>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-500">{error}</p>
      )}

      {receipt && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:bg-green-900/20">
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
            ZK proof verified ✓ — amount hidden
          </p>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
            Nullifier: {receipt.nullifierHash.slice(0, 24)}…
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Real UltraHonk proof: {receipt.proofBytes.toLocaleString()} bytes
          </p>
          <a
            href={receipt.contentUrl}
            className="mt-3 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm text-white"
          >
            Read article
          </a>
        </div>
      )}
    </div>
  );
}