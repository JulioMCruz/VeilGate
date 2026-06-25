"use client";

/**
 * PayButton component — generated via stellar_x402_nextjs_scaffold
 * Reference: https://github.com/JulioMCruz/Stellar-mcp/docs/PERKOS_STELLAR_X402_GUIDE.md
 *
 * Client-side x402 payment button using Freighter.
 * Signs Stellar auth entry and retries request with X-PAYMENT header.
 */

import { useState } from "react";
import { useStellarWallet } from "@/lib/useStellarWallet";

interface PayButtonProps {
  contentUrl: string;
  amount: string;
  onSuccess?: (content: any) => void;
}

export function PayButton({ contentUrl, amount, onSuccess }: PayButtonProps) {
  const { wallet, signTx, isConnected } = useStellarWallet();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!isConnected || !wallet) {
      setError("Connect Freighter wallet first");
      return;
    }

    setPaying(true);
    setError(null);

    try {
      // Step 1: Fetch content to get 402 + x402 requirements
      const firstAttempt = await fetch(contentUrl);

      if (firstAttempt.status !== 402) {
        // Already accessible or error
        const data = await firstAttempt.json();
        onSuccess?.(data);
        return;
      }

      const requirements = await firstAttempt.json();
      const x402 = requirements.x402;

      // Step 2: Sign auth entry with Freighter
      // In production: use @x402/fetch or @x402/stellar client
      // For demo: placeholder signing
      const mockPayment = {
        scheme: x402.scheme,
        network: x402.network,
        amount: x402.amount,
        asset: x402.asset,
        payer: wallet.address,
        timestamp: Date.now(),
        signature: "placeholder-signature",
      };

      // Step 3: Retry with X-PAYMENT header
      const secondAttempt = await fetch(contentUrl, {
        headers: {
          "X-PAYMENT": JSON.stringify(mockPayment),
          "Content-Type": "application/json",
        },
      });

      if (!secondAttempt.ok) {
        throw new Error(`Payment failed: ${secondAttempt.status}`);
      }

      const content = await secondAttempt.json();
      onSuccess?.(content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  if (!isConnected) {
    return (
      <p className="text-sm text-gray-500">
        Connect your wallet to pay for this content.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handlePay}
        disabled={paying}
        className="rounded-xl bg-veil-600 px-6 py-3 text-white shadow hover:bg-veil-500 transition disabled:opacity-50"
      >
        {paying
          ? "Processing payment..."
          : `Pay ${Number(amount) / 10_000_000} USDC`}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
