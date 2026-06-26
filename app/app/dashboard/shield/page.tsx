'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/lib/providers/wallet-provider';
import { generateShieldCommitment } from '@/lib/proof';
import { Card, AdvancedBadge, CopyButton, truncate } from '@/components/ui';

interface Shield {
  commitment: string;
  createdAt: string;
  spent: boolean;
}

const KEY = (a: string) => `veilgate.shields.${a}`;

export default function ShieldPage() {
  const { address } = useWallet();
  const [amount, setAmount] = useState(64);
  const [busy, setBusy] = useState(false);
  const [shields, setShields] = useState<Shield[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    try {
      const raw = localStorage.getItem(KEY(address));
      setShields(raw ? JSON.parse(raw) : []);
    } catch {
      setShields([]);
    }
  }, [address]);

  async function createShield() {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const { commitment } = await generateShieldCommitment(amount);
      const next = [{ commitment, createdAt: new Date().toISOString(), spent: false }, ...shields];
      localStorage.setItem(KEY(address), JSON.stringify(next));
      setShields(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create shield');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">Shield a payment</h1>
        <AdvancedBadge />
      </div>
      <p className="mt-1 text-sm text-gray-400">
        Pre-mint a payment commitment now and use it to unlock content later. Your amount
        stays private throughout.
      </p>

      <Card className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-veil-400">
          How shielding works
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Your browser generates a commitment — a cryptographic fingerprint of your amount —
          using the same Pedersen hash the circuit uses. Later, you present this commitment
          when paying a paywall instead of proving from scratch. The amount stays hidden, as
          always.
        </p>
      </Card>

      <Card className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-veil-400">
          Amount to shield
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
          aria-label="Amount to shield in centi-cents"
          className="mt-2 w-full accent-veil-500"
        />
        <button
          onClick={createShield}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-veil-600 px-6 py-3 font-medium text-white hover:bg-veil-500 disabled:opacity-50"
        >
          {busy ? 'Generating commitment…' : 'Generate shield commitment'}
        </button>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </Card>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-gray-400">
        Your shields
      </h2>
      {shields.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">
          No shields yet. Shield a commitment to pre-fund a future payment.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {shields.map((s, i) => (
            <Card key={i}>
              <div className="mono flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1 text-gray-300">
                  {truncate(s.commitment, 12, 8)}
                  <CopyButton value={s.commitment} label="commitment" />
                </span>
                <span className={s.spent ? 'text-gray-500' : 'text-green-400'}>
                  {s.spent ? 'Spent' : 'Unspent'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                Created {new Date(s.createdAt).toLocaleString()}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
