import Link from 'next/link';
import { TestnetPill } from '@/components/ui';

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      {/* Topbar */}
      <header className="flex items-center justify-between px-6 py-5">
        <span className="glow text-lg font-bold text-veil-400">VeilGate</span>
        <div className="flex items-center gap-3">
          <TestnetPill />
          <Link
            href="/connect"
            className="rounded-lg bg-veil-600 px-4 py-2 text-sm font-medium text-white hover:bg-veil-500"
          >
            Open app →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-3xl px-6 pb-12 pt-16 text-center">
        <div
          aria-hidden
          className="proof-glow pointer-events-none absolute left-1/2 top-10 -z-10 h-[520px] w-[520px] -translate-x-1/2 animate-proof-pulse"
        />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-veil-400">
          Pay without revealing how much
        </p>
        <h1 className="mt-5 text-5xl font-bold leading-tight sm:text-6xl">
          Read anything.
          <br />
          <span className="glow text-veil-400">Leave no trace.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-gray-400">
          VeilGate lets you pay for premium articles on Stellar without exposing your
          payment amount — to the publisher, to the network, or to anyone. A mathematical
          proof runs in your browser and confirms you paid a valid amount. The number
          itself stays on your device.
        </p>
        <div className="mt-9 flex flex-col items-center gap-2">
          <Link
            href="/connect"
            className="rounded-xl bg-veil-600 px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-veil-900/40 transition hover:bg-veil-500"
          >
            Connect Freighter to start
          </Link>
          <p className="text-xs text-gray-500">
            No account. No email. Your Freighter wallet is your identity.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          <Step n="1" title="Choose your price">
            Pick any amount between 1 and 255 centi-cents. It never leaves your browser tab.
          </Step>
          <Step n="2" title="Your browser proves it">
            A zero-knowledge proof is generated locally (a few seconds). It says “valid
            amount” without revealing the number.
          </Step>
          <Step n="3" title="Content unlocks">
            The proof is verified. The article opens. Nobody learned how much you paid.
          </Step>
        </div>
      </section>

      {/* Privacy proof strip */}
      <section className="mx-auto max-w-4xl px-6 py-10">
        <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-wide text-gray-400">
          What the world sees vs. what you keep private
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-veil-900/70 bg-gray-900/70 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-veil-400">
              Visible to the publisher
            </p>
            <ul className="mono space-y-1.5 text-sm text-gray-300">
              <li>nullifier 0x4a3f…c2d1</li>
              <li>timestamp 14:22 UTC</li>
              <li>proof ✓ valid</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-veil-900/70 bg-gray-900/70 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-400">
              Kept on your device
            </p>
            <ul className="mono space-y-1.5 text-sm text-gray-300">
              <li>amount ████ (hidden by design)</li>
              <li>secret ████</li>
              <li>your identity ████</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Testnet notice */}
      <footer className="mx-auto max-w-4xl px-6 pb-16 pt-6 text-center">
        <p className="rounded-xl border border-amber-400/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
          Running on Stellar Testnet · Proofs are real · Contracts are not audited · Do not
          use real funds
        </p>
      </footer>
    </main>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-veil-900/70 bg-gray-900/40 p-6">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-veil-600 text-sm font-bold text-white">
        {n}
      </div>
      <h3 className="font-semibold text-veil-300">{title}</h3>
      <p className="mt-2 text-sm text-gray-400">{children}</p>
    </div>
  );
}
