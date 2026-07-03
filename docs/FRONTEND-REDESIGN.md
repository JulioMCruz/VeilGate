# VeilGate — Front-End Redesign (Phase 2)

> ## 🔎 TL;DR
> Phase 1 (QA + the relayer fix — see [`README.md`](./README.md)) shipped the real
> unlinkability guarantee. Phase 2 is the visual layer on top of it: a full re-skin of the
> dashboard (Home / Pay / Activity / Wallet), a Picasso-style brand system (tokens, hero art,
> custom icons), a responsive pass across the whole site, and a `/pitchdeck` walkthrough that
> tells the relayer story instead of the generic elevator pitch. No shielded-pool logic changed
> — this branch is presentation only.

## What changed

- **Design system** — `ink` / `veil` / `pulse` color tokens, a φ-based type scale
  (`text-display`, `text-display-sm`, `text-display-lg`), hairline borders instead of hard
  panels, and one accent color per screen instead of several competing highlights.
- **Landing** (`app/app/page.tsx`) — full-bleed hero with a looping brand video, real feature
  strip (custom-generated icons, titles only), copy that describes what's actually shipped
  (shielded pool, relayer-submitted payout) instead of generic Web3 language.
- **Dashboard re-skin** (Home, Pay, Activity, Wallet) — restyled to match reference mockups
  while keeping every number real: wallet balances, per-pool deposit counts, and pending-note
  totals all come from the same hooks the app already used. No hardcoded figures, no fake
  notifications, no USD estimates (no price feed exists).
- **Responsive audit** — every page reviewed against standard breakpoints (mobile browser
  resize tooling isn't reliable in this environment, so this was a systematic code-level pass);
  fixed a real overlap between the Hermes floating button and the mobile tab bar, among other
  breakpoint issues.
- **`/pitchdeck`** (`app/components/pitch-deck.tsx`, `app/app/pitchdeck/page.tsx`) — a
  10-slide keyboard/click carousel reachable from the landing nav ("Learn more"). Content
  mirrors the real architecture: the relayer as its own actor, the deposit/payout split as the
  thing that actually breaks the on-chain link (not just the proof), and what's verified on
  testnet today. Backgrounds are full-bleed brand art per slide; slides without a background
  image get a light CSS-only particle field so the deck never reads as a plain text wall.

## Working rules

- Feature branch only (`dex/front-end`); **never** commit to `main`; changes land via PR.
- No secrets committed; no `NEXT_PUBLIC_*` additions.
- Purely presentational — no changes to pool/proof/relayer contract logic in this branch.
- Verified after each change: `cd app && npm run type-check && npm test` (22 Vitest tests) plus a
  manual browser pass.
