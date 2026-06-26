# VeilGate — QA Findings & Fixes (Phase 1)

Manual QA of `app/` against **Stellar testnet** with Freighter. Every on-chain claim was
verified independently against Horizon testnet.

- Tester wallet: `GAS45G7S…56MX6BU5` (friendbot-funded).
- Second destination (to rule out a pay-to-self artifact): `GDRA7SYF…W5O53U`.
- Relayer account (for the #1 fix): `GDEJXO76…5HDOYD`.
- The headline privacy finding (#1) has its own deep dive: [`UNLINKABILITY-PLAN.md`](./UNLINKABILITY-PLAN.md).

Status legend: ✅ fixed · ↗ escalated · ⏳ pending.

---

## ✅ Working (happy path)

Connect wallet · denominations 0.1/1/10 XLM + live anonymity-set indicator · **real 0.1 XLM
payment** (deposit → in-browser Groth16 proof → on-chain withdraw) · full receipt · on-chain
verification · Activity log · Wallet · dashboard home · Hermes (`/settle`, `/wallet`,
`/history`, `/verify`, graceful unknown command) · invalid address disables the pay button ·
disconnect → landing · wrong network blocked by Freighter.

---

## 🐛 Findings & fixes (in order)

### #1 — [HIGH] ✅ Unlinkability was broken on-chain (verified) — headline
The pool is supposed to hide *who paid whom*, but the deposit and the withdraw were submitted by the **same account**, so anyone could link payer → publisher.
- **Evidence (pay to a *different* account, rules out a pay-to-self artifact):**
  - Deposit `5494e105…` → source `GAS45G7S`, seq …645
  - Withdraw `2ad32e9a…` → source `GAS45G7S` (same), seq …646, pays `GDRA7`
- **Cause:** `app/lib/pool.ts` → `invoke(server, from, 'withdraw', …)` used the depositor as the tx source. The withdraw args don't include the depositor, so it doesn't actually need their signature.
- **Fix:** route the withdraw through a server-side relayer (different source account). Full plan, required conditions, trust model, and on-chain acceptance criteria in [`UNLINKABILITY-PLAN.md`](./UNLINKABILITY-PLAN.md).
- **Status:** ✅ implemented + verified on-chain, and **live in production** (`RELAYER_SECRET`
  configured on Vercel; relayer account funded). With #10 fixed, a fresh end-to-end payment confirms
  it: deposit `6db258ac…` source `GAZLMPAT…` (depositor) **≠** withdraw `5622d492…` source
  `GAJIZIWL…` (relayer) — different accounts, no shared source (verified on Horizon).

### #2 — [MEDIUM] ✅ "Open dashboard →" landed on a broken demo
- **What:** after connecting, the "Open dashboard →" button (`app/app/connect/page.tsx:42`) did `router.push('/dashboard/pay')` — an out-of-nav demo that moved no value and was itself broken (see #5).
- **Fix:** push to `/dashboard` (the real home).

### #3 — [LOW] ✅ Wallet balance was shown rounded
- **What:** Wallet showed "10,000" while the real balance was `9999.9854` (fees/movement hidden).
- **Fix:** render the full balance with decimals in `app/app/dashboard/wallet/page.tsx`.

### #4 — [MEDIUM] ✅ "Testnet" badge was hardcoded; wrong network not detected
- **What:** the UI always showed "Testnet"; on Main Net it only failed at signing time (Freighter caught it, not the app). `network` was hardcoded in `app/lib/wallet.ts`.
- **Fix:** read Freighter's actual network (`getNetwork`); the wallet provider exposes it (and keeps it live via polling + refocus), the Pay screen warns + disables when not on Test Net, and a `NetworkPill` next to the address shows the real network.

### #5 — [MEDIUM] ⏳ Demo `/dashboard/pay` fails to generate a proof (left as-is, unsurfaced)
- **What:** `/dashboard/pay` → "Something went wrong. The proof could not be generated." It uses `@aztec/bb.js` (UltraHonk), whose WASM fails to init — a legacy stack predating the snarkjs/Groth16 pool flow.
- **Decision:** the demo page isn't part of the real flow and isn't ours to delete. It's left in place but kept **unsurfaced**: out of nav, not in Hermes's documented commands (`/settle /wallet /history /verify` — the undocumented `/pay` navigation was dropped), and connect now lands on `/dashboard` (#2). The broken demo is no longer reachable from the app UI. Fixing the bb.js stack is out of scope (only ensure what's surfaced works).

### #6 — [MEDIUM] ⏳ Demo `/dashboard/shield` crashes (left as-is, unsurfaced)
- **What:** `/dashboard/shield` → "Object.defineProperty called on non-object" — same bb.js init failure as #5.
- **Decision:** same as #5 — left in place, kept unsurfaced (the undocumented Hermes `/shield` navigation was dropped).

### #7 — [LOW] ✅ Hermes `/history` showed an empty publisher field
- **What:** `app/components/hermes.tsx` rendered `domainOf(r.contentUrl)`, but the pool flow stores the destination in `publisherDomain` (`contentUrl` is empty) — leftover from the "pay a URL" → pool pivot.
- **Fix:** render `r.publisherDomain`.

### #8 — [HIGH] ✅ No check that the destination exists
- **What:** paying < 1 XLM to a non-existent account failed the withdraw with a raw `HostError #14` (`"transfer amount is below minimum balance for new account"`). Stellar needs ≥ 1 XLM to create an account, and the deposit had already executed (see #9).
- **Fix:** pre-flight the recipient in `app/lib/pool.ts` before depositing; if it doesn't exist and the denomination is under the 1 XLM minimum, fail early with a clear message. (Production option: create new accounts via Sponsored Reserves through the relayer.)

### #9 — [HIGH / fund safety] ✅ A failed withdraw stranded the deposit
- **What:** the flow deposits first, withdraws second; a failure/abandon between them locked the deposit in the pool and the in-memory note (secret) was lost on navigation → unrecoverable funds (tester balance dropped ~0.208 XLM across stuck attempts).
- **Fix:** persist the note locally **before** depositing (`app/lib/pending.ts`) and clear it on a successful withdraw; the Pay screen lists pending deposits with a "Retry payout" that re-proves and pays via the relayer with no new deposit (`app/components/pending-withdraws.tsx`, `retryWithdraw` in `lib/pool.ts`).

### #10 — [HIGH / architectural] ✅ Withdraw failed with `RootUnknown` once the oldest deposit aged out
- **What:** the app rebuilds the Merkle tree by replaying `deposit` events from Soroban RPC, but RPC only retains events for a limited window. Once the earliest deposit (leaf 0) ages out, clients can no longer reconstruct the correct tree, so the computed root never matches the contract's `current_root` → `withdraw` panics with `Error(Contract, #1) = RootUnknown` (that `#1` is the contract's error code, not a finding number). This breaks **all** withdrawals from any pool older than the retention window. Independent of #1.
- **Evidence:** visible deposit events are indices 1..9 (index 0 aged out; wider RPC windows return empty). The failed withdraw sent root `0a59d8…` (the browser's gap-filled reconstruction); the contract's real `current_root` is `268d1b…`; neither a gap-filled nor a packed reconstruction matches → leaf 0 is genuinely unrecoverable from events.
- **Fix (architectural — contract-side):** stop depending on RPC event retention. Options: (a) the pool stores commitments in persistent storage and exposes a getter so clients can always fetch the full leaf set; (b) a persistent indexer that records every deposit and serves the leaves; (c) for demos, deploy fresh pools and withdraw within the retention window.
- **Status:** ✅ **FIXED (contract-side).** The pool now stores every commitment in persistent
  storage and exposes `leaf_count()` + `commitments()`; the client rebuilds the tree from
  `commitments()` (a read-only simulation), independent of event retention. Fresh pools deployed
  (0.1 `CBTZ…RRNCI`, 1 `CAUZ…7B2Z`, 10 `CBJU…FBJY`). Verified end-to-end on testnet: deposit
  `6db258ac…` → rebuild from the getter (not events) → relayer withdraw `5622d492…` paid the
  publisher, **no `RootUnknown`**.

---

## Pending QA
- Reject the withdraw mid-flow — does the UI recover? (with the relayer, the user now signs only the deposit; relevant to the #9 retry path).
- Double-spend (nullifier) — needs a separate technical test.
- `npm test` (22 Vitest) — currently green; `npm run build` baseline.
