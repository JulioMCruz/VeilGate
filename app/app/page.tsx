import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-24">
      <div className="text-center">
        <h1 className="glow text-5xl font-bold text-veil-600 dark:text-veil-500">
          VeilGate
        </h1>
        <p className="mt-4 text-2xl text-gray-700 dark:text-gray-300">
          Pay any content. Reveal nothing.
        </p>
        <p className="mt-6 max-w-2xl mx-auto text-gray-600 dark:text-gray-400">
          A privacy-preserving paywall built on Stellar. Your payment amount
          is hidden from the publisher and from on-chain observers. The
          publisher still gets paid in full, you still get the content, and
          no one learns how much you paid.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 max-w-xl mx-auto">
          <Link
            href="/premium"
            className="rounded-xl bg-veil-600 px-6 py-4 text-white shadow-lg hover:bg-veil-500 transition"
          >
            Try the demo
          </Link>
          <a
            href="https://github.com/JulioMCruz/VeilGate"
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-xl border border-veil-600 px-6 py-4 text-veil-600 hover:bg-veil-50 transition"
          >
            View source
          </a>
        </div>
      </div>

      <section className="mt-24 grid gap-8 sm:grid-cols-3">
        <FeatureCard
          title="Private amount"
          body="Your payment amount is hidden using a Groth16 zero-knowledge proof verified by Soroban."
        />
        <FeatureCard
          title="On Stellar"
          body="Uses Protocol 25 BN254 host functions for on-chain verification. No external verifier."
        />
        <FeatureCard
          title="No double-spend"
          body="Each payment has a unique nullifier that cannot be replayed across publishers or sessions."
        />
      </section>

      <section className="mt-24 text-center text-sm text-gray-500">
        Built for the{' '}
        <a
          href="https://dorahacks.io/hackathon/stellar-hacks-zk/detail"
          className="underline hover:text-veil-600"
        >
          Stellar Hacks: Real-World ZK
        </a>{' '}
        hackathon. MIT licensed.
      </section>
    </main>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
      <h3 className="font-semibold text-veil-600">{title}</h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{body}</p>
    </div>
  );
}