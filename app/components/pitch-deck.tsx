'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { HeroVideo } from '@/components/hero-video';
import { Card, PrivacyBadge } from '@/components/ui';
import { UseCases } from '@/components/use-cases';

/**
 * The pitch deck — a slide-by-slide walkthrough of the product for judges/
 * viewers, reusing the same brand system (tokens, HeroVideo, Card, UseCases)
 * as the rest of the site. Content is drawn straight from the project README
 * (problem/solution, the 4-step flow, roles, architecture, what's verified on
 * testnet) — nothing invented.
 */

const TOTAL = 10;

export function PitchDeck() {
  const [i, setI] = useState(0);

  const next = useCallback(() => setI((n) => Math.min(TOTAL - 1, n + 1)), []);
  const prev = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-950">
      {/* Exit — subtle, top right */}
      <Link
        href="/"
        aria-label="Exit to landing"
        className="fixed right-5 top-5 z-50 flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-ink-900/70 hover:text-white"
      >
        ✕
      </Link>

      {/* Slide */}
      <div key={i} className="animate-fade-up flex min-h-screen w-full items-center justify-center px-6 py-20">
        {SLIDES[i]}
      </div>

      {/* Prev / next arrows */}
      <button
        onClick={prev}
        disabled={i === 0}
        aria-label="Previous slide"
        className="hairline fixed left-4 top-1/2 z-40 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink-900/70 text-gray-300 backdrop-blur transition hover:text-white disabled:opacity-0 sm:flex"
      >
        ‹
      </button>
      <button
        onClick={next}
        disabled={i === TOTAL - 1}
        aria-label="Next slide"
        className="hairline fixed right-4 top-1/2 z-40 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink-900/70 text-gray-300 backdrop-blur transition hover:text-white disabled:opacity-0 sm:flex"
      >
        ›
      </button>

      {/* Progress dots + mobile prev/next */}
      <div className="fixed inset-x-0 bottom-6 z-40 flex items-center justify-center gap-4">
        <button onClick={prev} disabled={i === 0} aria-label="Previous slide" className="text-gray-500 disabled:opacity-20 sm:hidden">
          ‹
        </button>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL }, (_, n) => (
            <button
              key={n}
              onClick={() => setI(n)}
              aria-label={`Go to slide ${n + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                n === i ? 'w-6 bg-veil-400' : 'w-1.5 bg-gray-700 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
        <button onClick={next} disabled={i === TOTAL - 1} aria-label="Next slide" className="text-gray-500 disabled:opacity-20 sm:hidden">
          ›
        </button>
      </div>
      <p className="fixed bottom-6 right-6 z-40 hidden text-xs text-gray-600 sm:block">
        {i + 1} / {TOTAL}
      </p>
    </main>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="hairline inline-flex items-center gap-2 rounded-full bg-ink-900/70 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-veil-300 backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full bg-veil-400" /> {children}
    </p>
  );
}

// Full-bleed art background (same pattern as the cover slide) — the mascot
// scene sits on the right of each source image, so a left-to-right scrim
// keeps the text column on the left readable without hiding the art.
function BgSlide({
  src,
  position = 'center',
  children,
}: {
  src: string;
  position?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative -mx-6 -my-20 flex min-h-screen w-screen items-center overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <Image
          src={src}
          alt=""
          fill
          className="object-cover"
          style={{ objectPosition: position }}
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/55 to-transparent" />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <div className="max-w-xl">{children}</div>
      </div>
    </div>
  );
}

// Ambient particle backdrop for slides that don't have a full-bleed art
// background — keeps the deck feeling alive instead of a plain black page.
function ParticleSlide({
  children,
  contentClassName = 'max-w-4xl',
}: {
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="relative -mx-6 -my-20 flex min-h-screen w-screen items-center justify-center overflow-hidden px-6 py-20">
      <div aria-hidden className="particle-field absolute inset-0 -z-10" />
      <div className={`relative z-10 mx-auto w-full ${contentClassName}`}>{children}</div>
    </div>
  );
}

const SLIDES: React.ReactNode[] = [
  // 1 — Cover: hero video, left-aligned like the real landing hero, no logo lockup
  <div key="cover" className="relative -mx-6 -my-20 flex min-h-screen w-screen items-center overflow-hidden">
    <div className="absolute inset-0 -z-10">
      <Image src="/brand/hero-veil.png" alt="" fill priority className="object-cover object-[72%_center]" sizes="100vw" />
      <HeroVideo />
      <div className="absolute inset-0 bg-ink-950/60" />
    </div>
    <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
      <div className="max-w-xl">
        <Eyebrow>Stellar Hacks: Real-World ZK</Eyebrow>
        <h1 className="mt-5 text-display font-bold text-white sm:text-display-lg">
          Pay without <span className="text-veilgrad">leaving a trace.</span>
        </h1>
        <p className="mt-4 text-lg text-gray-300">
          A zero-knowledge shielded pool for private payments on Stellar.
        </p>
      </div>
    </div>
  </div>,

  // 2 — The problem
  <BgSlide key="problem" src="/brand/bg-laptop.png" position="70% center">
    <Eyebrow>The problem</Eyebrow>
    <h2 className="mt-6 text-display-sm font-bold text-white sm:text-display">
      Public chains have <span className="text-veilgrad">no privacy.</span>
    </h2>
    <p className="mt-5 text-lg leading-relaxed text-gray-300">
      Every on-chain payment links your wallet to who you paid, forever.
    </p>
    <p className="mt-3 text-lg leading-relaxed text-gray-300">
      Card rails aren&apos;t better — the processor sees it all too.
    </p>
  </BgSlide>,

  // 3 — The solution
  <ParticleSlide key="solution" contentClassName="max-w-4xl text-center">
    <Image
      src="/brand/icon-unlinkable.png"
      alt=""
      width={56}
      height={56}
      className="mx-auto h-14 w-14 object-contain"
    />
    <Eyebrow>The solution</Eyebrow>
    <h2 className="mt-6 text-display-sm font-bold text-white sm:text-display">A shielded pool.</h2>
    <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-400">
      Deposit now, pay later from an unrelated withdrawal — a proof links the two without
      revealing which deposit it was.
    </p>
    <div className="mt-10 grid gap-4 sm:grid-cols-2">
      <div className="hairline rounded-2xl bg-ink-900/50 p-6 text-left">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-veil-400">Public on-chain</p>
        <ul className="mono space-y-2 text-sm text-gray-300">
          <li>deposit tx → pool</li>
          <li>payout tx → publisher</li>
          <li>proof <span className="text-green-400">✓ valid</span></li>
        </ul>
      </div>
      <div className="hairline rounded-2xl bg-ink-900/50 p-6 text-left">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-amber-400">Hidden by math</p>
        <ul className="mono space-y-2 text-sm text-gray-300">
          <li>who paid whom ████</li>
          <li>which deposit funded it ████</li>
          <li>note secret ████</li>
        </ul>
      </div>
    </div>
  </ParticleSlide>,

  // 4 — How it works (what's actually shipped: deposit is the ONLY signature;
  // the payout is submitted by a relayer, not Freighter — that's what makes the
  // deposit/payout link unlinkable on-chain, not just the proof.)
  <BgSlide key="how" src="/brand/bg-payment.png" position="65% center">
    <Eyebrow>How it works</Eyebrow>
    <h2 className="mt-6 text-display-sm font-bold text-white sm:text-display">
      One signature. A relayer pays them.
    </h2>
    <ol className="mt-6 space-y-3 text-lg text-gray-300">
      <li><span className="text-veil-400">1.</span> Deposit — the only tx you sign.</li>
      <li><span className="text-veil-400">2.</span> Prove — a Groth16 proof, in-tab.</li>
      <li><span className="text-veil-400">3.</span> Relayer pays — not your wallet.</li>
    </ol>
    <p className="mt-5 text-sm text-gray-400">
      Different source accounts on deposit and payout — that&apos;s what breaks the on-chain link.
    </p>
  </BgSlide>,

  // 5 — Architecture (the relayer is the piece that makes unlinkability real,
  // not just theoretical — it's drawn as its own actor here, deliberately)
  <BgSlide key="architecture" src="/brand/bg-dashboard.png" position="65% center">
    <Eyebrow>Architecture</Eyebrow>
    <h2 className="mt-6 text-display-sm font-bold text-white sm:text-display">
      Trustless by construction.
    </h2>
    <ul className="mt-6 space-y-3 text-lg text-gray-300">
      <li>⬡ Browser proves — Freighter signs the deposit only</li>
      <li>🔁 Relayer submits the withdraw — never the depositor</li>
      <li>🌳 Soroban pool — on-chain Merkle root, no operator</li>
    </ul>
  </BgSlide>,

  // 6 — Roles
  <ParticleSlide key="roles" contentClassName="max-w-4xl">
    <div className="text-center">
      <Eyebrow>Roles</Eyebrow>
      <h2 className="mt-6 text-display-sm font-bold text-white sm:text-display">Three roles. No operator.</h2>
    </div>
    <div className="mt-10 grid gap-4 sm:grid-cols-3">
      <Card className="text-center">
        <Image src="/brand/mascot.png" alt="" width={64} height={64} className="mx-auto h-16 w-16 object-contain" />
        <p className="mt-3 font-semibold text-veil-300">Reader</p>
        <p className="mt-1 text-sm text-gray-400">Deposits, proves, pays — keeps the secret.</p>
      </Card>
      <Card className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center text-4xl">📬</span>
        <p className="mt-3 font-semibold text-veil-300">Publisher</p>
        <p className="mt-1 text-sm text-gray-400">Gets paid — never sees the reader&apos;s wallet.</p>
      </Card>
      <Card className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center text-4xl">✦</span>
        <p className="mt-3 font-semibold text-veil-300">Hermes</p>
        <p className="mt-1 text-sm text-gray-400">Optional agent — same on-chain ops, no keys.</p>
      </Card>
    </div>
    <p className="mt-6 text-center text-sm text-gray-500">
      <span className="text-gray-400 line-through">Operator</span> — there is none.
    </p>
  </ParticleSlide>,

  // 7 — Verified on testnet
  <BgSlide key="verified" src="/brand/bg-activity.png" position="65% center">
    <Eyebrow>Status</Eyebrow>
    <h2 className="mt-6 text-display-sm font-bold text-white sm:text-display">Verified on testnet.</h2>
    <ul className="mt-6 space-y-2 text-lg text-gray-300">
      <li>✓ Real XLM payments moved</li>
      <li>✓ Trustless root — no operator</li>
      <li>✓ Groth16 verified on-chain</li>
      <li>✓ Relayer withdraw — different source account, confirmed</li>
    </ul>
    <p className="mono mt-5 text-xs text-gray-500">
      Pool 0.1 XLM: CBTZN7…RRNCI · Pool 1 XLM: CAUZIY…7B2Z · Pool 10 XLM: CBJUMM…FBJY
    </p>
  </BgSlide>,

  // 8 — Use cases (reuse the landing's component)
  <ParticleSlide key="usecases" contentClassName="max-w-5xl">
    <div className="text-center">
      <Eyebrow>What you can build</Eyebrow>
      <h2 className="mt-6 text-display-sm font-bold text-white sm:text-display">Real use cases.</h2>
    </div>
    <div className="mt-10">
      <UseCases />
    </div>
  </ParticleSlide>,

  // 9 — Tech stack
  <ParticleSlide key="stack" contentClassName="max-w-3xl text-center">
    <Eyebrow>Toolchain</Eyebrow>
    <h2 className="mt-6 text-display-sm font-bold text-white sm:text-display">Open source, end to end.</h2>
    <Image
      src="/brand/icon-opensource.png"
      alt=""
      width={56}
      height={56}
      className="mx-auto mt-6 h-14 w-14 object-contain"
    />
    <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
      <Card className="!p-4">
        <p className="font-semibold text-gray-100">Circom 2 + snarkjs</p>
        <p className="mt-1 text-sm text-gray-500">In-browser Groth16 proving.</p>
      </Card>
      <Card className="!p-4">
        <p className="font-semibold text-gray-100">Soroban SDK (Rust)</p>
        <p className="mt-1 text-sm text-gray-500">Native BN254 + Poseidon.</p>
      </Card>
      <Card className="!p-4">
        <p className="font-semibold text-gray-100">Next.js 14 + Freighter</p>
        <p className="mt-1 text-sm text-gray-500">The reader app and Hermes agent.</p>
      </Card>
      <Card className="!p-4">
        <p className="font-semibold text-gray-100">MIT licensed</p>
        <p className="mt-1 text-sm text-gray-500">Full source, public on GitHub.</p>
      </Card>
    </div>
  </ParticleSlide>,

  // 10 — Closing CTA
  <ParticleSlide key="closing" contentClassName="max-w-2xl text-center">
    <Image
      src="/brand/mascot-closing.png"
      alt=""
      width={338}
      height={303}
      className="mx-auto h-72 w-80 animate-float object-contain sm:h-[22rem] sm:w-96"
    />
    <h2 className="mt-2 text-display-sm font-bold text-white sm:text-display">Disappear into the crowd.</h2>
    <p className="mx-auto mt-4 max-w-md text-gray-400">
      Real payments on Stellar testnet, verified by zero-knowledge proofs.
    </p>
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      <a
        href="https://github.com/JulioMCruz/VeilGate"
        target="_blank"
        rel="noreferrer noopener"
        className="rounded-xl bg-veil-600 px-7 py-3.5 text-base font-medium text-white shadow-lg shadow-veil-900/50 transition hover:bg-veil-500"
      >
        View on GitHub
      </a>
    </div>
    <div className="mt-6 flex justify-center">
      <PrivacyBadge>unlinkable by design</PrivacyBadge>
    </div>
  </ParticleSlide>,
];
