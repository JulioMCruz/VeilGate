# app/ — VeilGate Next.js frontend

VeilGate is a **trustless, fixed-denomination shielded pool on Stellar (Soroban)**.
It lets you pay a publisher in **native XLM on testnet** so that an on-chain
observer **cannot link your deposit to the publisher's payout** — the link
between payer and payee is broken, and your identity is hidden.

> **What it does and does NOT hide.** The privacy property is **unlinkability**
> plus **identity hiding**. The **denomination is public** (you choose 0.1, 1, or
> 10 XLM, and that amount is visible on-chain). VeilGate does **not** hide the
> amount — it hides *who paid whom*.

Live: <https://veilgate.vercel.app>

## How a payment works

A payment is two **separate, unlinkable** Stellar transactions, driven entirely
from the browser by `lib/pool.ts` (`payPrivately`). No operator or server custody
is involved — the pool contract recomputes its Merkle root on-chain on every
deposit.

1. **Pick a denomination** — 0.1 / 1 / 10 XLM. Each denomination is its own pool
   contract (`lib/pool-config.ts`), so you only ever blend in with deposits of the
   same size; that's what keeps each anonymity set meaningful.
2. **Deposit** — a fresh note (`secret`, `nullifier`, Poseidon `commitment`) is
   generated, and the commitment is deposited into the pool in one Freighter-signed
   transaction. The contract recomputes the tree root on-chain.
3. **Prove — in your browser** — the browser rebuilds the commitment tree from the
   pool's on-chain `deposit` events, finds this note's Merkle path, and generates a
   **Groth16 proof with snarkjs** (`/pool/withdraw.wasm` + `withdraw_final.zkey`).
   **The note secret never leaves the tab.** The proof is bound to the recipient
   (a field derived from the publisher's address), so a proof can only ever pay the
   intended account.
4. **Withdraw & pay** — a second transaction submits the proof, the recent root,
   and the nullifier hash. The pool contract **verifies the Groth16 proof on-chain**,
   records the nullifier (blocking double-spends), and pays the publisher.

Because the deposit and the withdraw are independent transactions over a shared
pool, no observer can connect the account that deposited to the publisher who was
paid.

## Key files & components

- `lib/pool.ts` — the real settlement flow: `payPrivately`, `newNote`, on-chain
  tree rebuild from `deposit` events, browser Groth16 proving, deposit + withdraw
  invocation, and `countDeposits` (the live anonymity-set size).
- `lib/pool-config.ts` — the three denominations (0.1 / 1 / 10 XLM) and their pool
  contract IDs. Each is a distinct `C…` Soroban contract running the identical code
  and verification key.
- `components/settle-flow.tsx` — the **Pay** screen: publisher address input,
  denomination picker with a live "deposits in this pool" indicator, staged
  progress (depositing → proving → paying), and a confirmation receipt with
  stellar.expert links.
- `components/dashboard-home.tsx` — the `/dashboard` home: hero, the 3-step
  explainer, live pool status (each denomination links to stellar.expert), recent
  payments, and use cases.
- `components/tx-log.tsx` — the **transaction log**. One row per payment: deposit
  tx + withdraw tx links to stellar.expert, a "proof verified on-chain" badge, the
  nullifier, the matched root, the anonymity-set size, and a "deposit ↔ payment
  unlinkable" badge.
- `components/hermes.tsx` — **Hermes**, an in-app chat agent that triggers the same
  on-chain operations as the UI via `/settle`, `/wallet`, `/history`, and `/verify`.
  It never touches your keys or your note secret.
- `app/dashboard/page.tsx` — renders the dashboard home.

### Navigation

The nav surfaces only the real settlement flow: **Home** (`/dashboard`),
**Pay** (`/dashboard/settle`), **Activity** (`/dashboard/history`), and
**Wallet** (`/dashboard/wallet`).

`/dashboard/pay` and `/dashboard/shield` are **in-browser proving demos** that
move **no value** and submit **no on-chain transaction** — they are intentionally
kept out of the nav.

## Verifying on-chain (for judges)

Every payment is auditable on **stellar.expert (testnet)**, and every link in the
app points there:

- The **transaction log** (Activity) and the post-payment receipt expose the
  **deposit tx** and the **withdraw tx** for each payment — two distinct hashes
  with no on-chain link between them.
- The **Pool** link opens the denomination's contract, where you can see all
  deposits in the anonymity set.
- The withdraw transaction is where the **Groth16 proof is verified on-chain** and
  the publisher is paid; the recorded **nullifier** is visible and is what blocks a
  second spend of the same note.

So a reviewer can open the deposit and the withdraw side by side and confirm there
is no on-chain evidence tying the depositing account to the publisher payout.

## Tokens

Real settlement uses **native XLM** on **Stellar testnet** only.

> An x402 USDC route exists at `app/api/content/route.ts` as a **non-judged
> scaffold** — it is **not** part of the shielded-pool flow and moves no value
> through the pool.

## Run / test / build

```bash
cd app
npm install
cp .env.example .env.local   # defaults work out of the box
npm run dev                  # http://localhost:3000
npm run build                # production build
npm test                     # Vitest — 22 tests
```

`npm test` runs **22 Vitest tests** across four files: the API routes
(`api.test.ts`), the Hermes agent (`hermes.test.tsx`), the lib helpers /
pool-config / history store (`lib.test.ts`), and the transaction log
(`tx-log.test.tsx`).

## Environment variables

No server secret is required — the shielded-pool flow is **fully client-side**.
All vars have baked-in defaults, so the app runs without configuration.

```bash
# Pool contract IDs, one per denomination (defaults are the deployed testnet pools)
NEXT_PUBLIC_POOL_01_XLM=C…   # 0.1 XLM pool
NEXT_PUBLIC_POOL_1_XLM=C…    # 1 XLM pool
NEXT_PUBLIC_POOL_10_XLM=C…   # 10 XLM pool

# Soroban testnet RPC
NEXT_PUBLIC_SOROBAN_RPC=https://soroban-testnet.stellar.org
```

Copy `.env.example` to `.env.local` to override any of these.

## Deployment

The app is a standard Next.js App Router project and deploys on **Vercel** — live
at <https://veilgate.vercel.app>.
