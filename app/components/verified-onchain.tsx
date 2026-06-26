import { Card, ExplorerLink, truncate } from '@/components/ui';
import { DENOMINATIONS } from '@/lib/pool-config';

/**
 * Real, immutable transactions executed end-to-end on Stellar testnet — shown so a
 * judge sees on-chain proof the system works even before making their own payment.
 * Each is a full private payment: a deposit tx and an unrelated withdraw tx.
 */
const PROVEN: { label: string; deposit: string; withdraw: string }[] = [
  {
    label: 'Private payment · 0.1 XLM',
    deposit: '6db258acc20d9fe98cee011684990f208590a476b3d0324ab51a5992cd503fbf',
    withdraw: '5622d49292ef40536f0b0883672a5f0718efd5932e434837eecbac146ab906b8',
  },
];

export function VerifiedOnchain() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-300">
          ✓ verified on testnet
        </span>
        <h3 className="text-sm font-semibold text-gray-200">Real on-chain proof</h3>
      </div>
      <p className="mt-2 text-sm text-gray-400">
        Real transactions on Stellar testnet — click to inspect on the block explorer. The deposit
        and the withdraw are two separate, unlinkable transactions.
      </p>

      <div className="mono mt-3 space-y-2 text-xs">
        {PROVEN.map((p) => (
          <div key={p.deposit} className="rounded-xl border border-veil-900/60 p-3">
            <p className="text-gray-300">{p.label}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-400">
              <span>
                Deposit <ExplorerLink kind="tx" id={p.deposit} />
              </span>
              <span>
                Withdraw <ExplorerLink kind="tx" id={p.withdraw} />
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-gray-500">Or inspect each pool&apos;s full history on-chain:</p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {DENOMINATIONS.map((d) => (
          <ExplorerLink key={d.poolId} kind="contract" id={d.poolId}>
            {`${d.label} pool (${truncate(d.poolId, 4, 4)}) ↗`}
          </ExplorerLink>
        ))}
      </div>
    </Card>
  );
}
