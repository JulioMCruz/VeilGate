import Image from 'next/image';
import Link from 'next/link';

/**
 * Landing — the brand at full strength (art direction: near-black canvas, one
 * violet accent, the veil ghost + particle streams as full-bleed hero art).
 * Copy tells the real story: a shielded pool on Stellar — unlinkability, not
 * amount-hiding (denominations are public by design).
 */
export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      {/* Topbar */}
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2.5">
          <Image src="/brand/logo-mark.png" alt="" width={34} height={34} className="h-[34px] w-[34px] object-contain" />
          <span className="text-lg font-bold tracking-tight text-white">VeilGate</span>
        </span>
        <nav className="hidden items-center gap-8 text-sm text-gray-400 sm:flex">
          <a href="#how" className="transition hover:text-white">How it works</a>
          <a href="#privacy" className="transition hover:text-white">Privacy</a>
          <a
            href="https://github.com/JulioMCruz/VeilGate"
            target="_blank"
            rel="noreferrer noopener"
            className="transition hover:text-white"
          >
            GitHub
          </a>
        </nav>
        <Link
          href="/connect"
          className="hairline rounded-xl px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-veil-900/30 hover:text-white"
        >
          Open app →
        </Link>
      </header>

      {/* Hero — full-bleed art, golden split, one focal point */}
      <section className="relative">
        <div className="absolute inset-0 -z-10">
          {/* Static art is the base layer (and the reduced-motion / no-js fallback)… */}
          <Image
            src="/brand/hero-veil.png"
            alt=""
            fill
            priority
            className="object-cover object-[72%_center]"
            sizes="100vw"
          />
          {/* …and the Kling loop plays over it when motion is allowed. */}
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/brand/hero-veil.png"
            className="absolute inset-0 h-full w-full object-cover object-[72%_center] motion-reduce:hidden"
          >
            <source src="/brand/hero-veil.mp4" type="video/mp4" />
          </video>
          <div className="scrim-l absolute inset-0" />
          <div className="scrim-b absolute inset-x-0 bottom-0 h-40" />
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 px-6 pb-24 pt-16 sm:pt-24 lg:grid-cols-[62fr_38fr] lg:pb-36">
          <div className="max-w-xl">
            <p className="hairline inline-flex items-center gap-2 rounded-full bg-ink-900/70 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-veil-300 backdrop-blur animate-fade-up">
              <span className="h-1.5 w-1.5 rounded-full bg-veil-400" /> Private payments on Stellar
            </p>
            <h1 className="mt-7 text-display font-bold text-white sm:text-display-lg animate-fade-up [animation-delay:80ms]">
              Pay without
              <br />
              leaving <span className="text-veilgrad">a trace.</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-gray-400 animate-fade-up [animation-delay:160ms]">
              VeilGate is a shielded pool on Stellar. Your deposit and the payout are two
              transactions <span className="text-gray-200">no one can link on-chain</span> — the
              publisher gets paid in full, and nobody learns it came from you.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3 animate-fade-up [animation-delay:240ms]">
              <Link
                href="/connect"
                className="rounded-xl bg-veil-600 px-7 py-3.5 text-base font-medium text-white shadow-lg shadow-veil-900/50 transition hover:bg-veil-500"
              >
                Pay privately →
              </Link>
              <a
                href="#how"
                className="hairline rounded-xl bg-ink-900/60 px-6 py-3.5 text-base text-gray-300 backdrop-blur transition hover:text-white"
              >
                How it works
              </a>
            </div>
            <div className="mt-12 flex flex-wrap items-center gap-x-7 gap-y-2 text-xs text-gray-500 animate-fade-up [animation-delay:320ms]">
              <span className="flex items-center gap-1.5"><span className="text-veil-400">◈</span> Groth16 verified on Soroban</span>
              <span className="flex items-center gap-1.5"><span className="text-veil-400">⬡</span> Freighter wallet</span>
              <span className="flex items-center gap-1.5"><span className="text-veil-400">&lt;/&gt;</span> Open source</span>
            </div>
          </div>

          {/* Empty column — keeps the golden-rectangle split so the art breathes on the right. */}
          <div aria-hidden className="hidden lg:block" />
        </div>
      </section>

      {/* Feature strip */}
      <section className="mx-auto max-w-6xl px-6">
        <div className="hairline grid gap-8 rounded-2xl bg-ink-900/50 p-8 backdrop-blur sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon="🔗" title="Unlinkable by design">
            The deposit and the payout are separate transactions with no on-chain connection.
          </Feature>
          <Feature icon="⬡" title="Prove, don’t reveal">
            A Groth16 proof is generated in your browser. The note secret never leaves your device.
          </Feature>
          <Feature icon="👥" title="Blend into the crowd">
            Fixed denominations (0.1 / 1 / 10 XLM) — every payment looks identical to the whole pool.
          </Feature>
          <Feature icon="🎯" title="Recipient-locked">
            The proof is bound to the payee on-chain. Swap the address and it’s rejected.
          </Feature>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-24">
        <h2 className="text-center text-display-sm font-bold text-white">How it works</h2>
        <p className="mx-auto mt-3 max-w-md text-center text-sm text-gray-500">
          Three steps. You sign once — the payout is submitted by a relayer, so your account never
          appears on it.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          <Step n="1" title="Deposit">
            Pick a denomination and lock it into the shielded pool with one Freighter signature. A
            secret note is created on your device.
          </Step>
          <Step n="2" title="Prove — in your browser">
            Your browser proves your note is in the pool (Groth16, ~seconds). The secret never
            leaves the tab.
          </Step>
          <Step n="3" title="A relayer pays them">
            The contract verifies the proof on-chain and pays the publisher — submitted by a
            relayer, not by you. Pay now, or shield and pay later.
          </Step>
        </div>
      </section>

      {/* What the chain sees vs what stays hidden */}
      <section id="privacy" className="mx-auto max-w-4xl scroll-mt-16 px-6 pb-24">
        <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
          What the chain sees vs. what stays hidden
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="hairline rounded-2xl bg-ink-900/50 p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-veil-400">
              Public on-chain
            </p>
            <ul className="mono space-y-2 text-sm text-gray-300">
              <li>deposit tx → pool <span className="text-gray-600">(from you)</span></li>
              <li>payout tx → publisher <span className="text-gray-600">(from a relayer)</span></li>
              <li>denomination 0.1 XLM <span className="text-gray-600">(same as everyone)</span></li>
              <li>nullifier 0x20fc… <span className="text-gray-600">(blocks double-spend)</span></li>
              <li>proof <span className="text-green-400">✓ valid</span></li>
            </ul>
          </div>
          <div className="hairline rounded-2xl bg-ink-900/50 p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-amber-400">
              Hidden by math
            </p>
            <ul className="mono space-y-2 text-sm text-gray-300">
              <li>who paid whom ████</li>
              <li>your wallet on the payout ████</li>
              <li>which deposit funded it ████</li>
              <li>note secret ████ <span className="text-gray-600">(never leaves your device)</span></li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-gray-600">
          Honest by design: the denomination is public — VeilGate hides <em>who paid whom</em>, not
          how much.
        </p>
      </section>

      {/* Ending — the other moment that matters */}
      <section className="relative mx-auto max-w-6xl px-6 pb-20">
        <div className="hairline relative overflow-hidden rounded-3xl bg-ink-900/60 px-8 py-16 text-center">
          <div
            aria-hidden
            className="proof-glow pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 animate-proof-pulse"
          />
          <Image
            src="/brand/mascot.png"
            alt=""
            width={96}
            height={96}
            className="relative mx-auto mb-6 h-24 w-24 animate-float object-contain"
          />
          <h2 className="relative text-display-sm font-bold text-white sm:text-display">
            Disappear into the crowd.
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-gray-400">
            Real payments on Stellar testnet, verified by zero-knowledge proofs on Soroban.
          </p>
          <Link
            href="/connect"
            className="relative mt-8 inline-block rounded-xl bg-veil-600 px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-veil-900/50 transition hover:bg-veil-500"
          >
            Connect Freighter to start
          </Link>
          <p className="relative mt-3 text-xs text-gray-600">
            No account. No email. Your wallet is your identity.
          </p>
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-gray-600">
          Running on Stellar Testnet · Proofs are real · Contracts are not audited · Do not use real
          funds
        </p>
      </section>
    </main>
  );
}

function Feature({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xl">{icon}</div>
      <h3 className="mt-3 font-semibold text-gray-100">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{children}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="hairline rounded-2xl bg-ink-900/50 p-7">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-veil-600/20 text-sm font-bold text-veil-300">
        {n}
      </div>
      <h3 className="mt-4 font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">{children}</p>
    </div>
  );
}
