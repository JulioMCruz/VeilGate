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
    deposit: '36972c83fb9071cd9ba1803836254370c461a1a6d894c97d975cedb8c53d7a37',
    withdraw: '8b4a91807c4b9e9d611ae6768dacfc62d87d43fbcf8e1f0b787331f13a9a1d91',
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
