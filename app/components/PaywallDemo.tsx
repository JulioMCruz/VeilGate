'use client';

import { useState } from 'react';
import { ConnectWallet } from './ConnectWallet';
import { generatePaymentProof } from '@/lib/proof';
import { signSorobanTx } from '@/lib/wallet';
import { buildVerifyTx, submitSorobanTx } from '@/lib/soroban';
import type { WalletAddress, PaymentReceipt } from '@/lib/types';

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

export function PaywallDemo() {
  const [wallet, setWallet] = useState<WalletAddress | null>(null);
  const [amount, setAmount] = useState(100); // centi-cents
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!wallet) {
      setError('Connect wallet first');
      return;
    }
    setPaying(true);
    setError(null);
    setReceipt(null);
    try {
      // 1. Generate ZK proof
      const { challenge, proof } = await generatePaymentProof(amount);

      // 2. Build Soroban tx
      const vk = {
        alpha_g1: '0x' + '0'.repeat(128),
        beta_g2: '0x' + '0'.replace(/./g, '0').repeat(128),
        gamma_g2: '0x' + '0'.repeat(128),
        delta_g2: '0x' + '0'.repeat(128),
        ic: ['0x' + '0'.repeat(128), '0x' + '0'.repeat(128), '0x' + '0'.repeat(128)],
      };

      const xdr = await buildVerifyTx(proof, vk, wallet.address);

      // 3. Sign with Freighter
      const signedXdr = await signSorobanTx(xdr, TESTNET_PASSPHRASE);

      // 4. Submit
      const txHash = await submitSorobanTx(signedXdr);

      // 5. Receive bearer token (placeholder)
      const bearer = `vg_${txHash.slice(0, 16)}`;
      setReceipt({
        txHash,
        nullifierHash: challenge.nullifierHash,
        bearerToken: bearer,
        contentUrl: '/premium/content',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setPaying(false);
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
          {paying ? 'Generating proof...' : `Pay ${amount} centi-cents`}
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-500">{error}</p>
      )}

      {receipt && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:bg-green-900/20">
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
            Payment verified
          </p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
            TX: {receipt.txHash}
          </p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
            Nullifier: {receipt.nullifierHash.slice(0, 20)}...
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