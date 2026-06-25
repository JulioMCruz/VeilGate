import { Card } from '@/components/ui';

/**
 * Realistic scenarios — honest to what's built (fixed denomination, unlinkability,
 * identity hiding; the amount is the public denomination).
 */
const USE_CASES: { icon: string; title: string; body: string }[] = [
  {
    icon: '📰',
    title: 'Read without a trail',
    body: 'Pay a journalist for an article. The publisher is paid by the pool, not by you — your reading habits stay off the public ledger.',
  },
  {
    icon: '💸',
    title: 'Tip a creator',
    body: 'Many supporters deposit the same denomination; each payout is unlinkable to a specific donor, so the supporter graph can’t be reconstructed.',
  },
  {
    icon: '🎗️',
    title: 'Anonymous donation',
    body: 'Give to a sensitive cause at a fixed tier (10 XLM). The tier is public; who gave stays hidden.',
  },
  {
    icon: '🔌',
    title: 'Metered API / dataset',
    body: 'Pre-deposit notes and settle each access to the provider unlinkably. The nullifier blocks reuse, so metering stays honest without a usage profile.',
  },
  {
    icon: '🛡️',
    title: 'Front-run-proof payout',
    body: 'Proofs are bound to the recipient on-chain — swap the address and the proof is rejected. Safe even in a public demo.',
  },
  {
    icon: '🧾',
    title: 'Sensitive contractor payout',
    body: 'Pay a researcher from the pool; the chain shows the pool paid them, not which employer’s deposit funded it.',
  },
];

export function UseCases() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {USE_CASES.map((u) => (
        <Card key={u.title} className="!p-4">
          <div className="text-xl">{u.icon}</div>
          <p className="mt-2 font-semibold text-gray-200">{u.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-400">{u.body}</p>
        </Card>
      ))}
    </div>
  );
}
