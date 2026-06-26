# VeilGate — QA Findings & Fixes (Phase 1)

Manual QA of `app/` against **Stellar testnet** with Freighter. Every on-chain claim was
verified independently against Horizon testnet.

- Tester wallet: `GAS45G7S…56MX6BU5` (friendbot-funded).
- Second destination (to rule out a pay-to-self artifact): `GDRA7SYF…W5O53U`.
- The headline privacy finding (#2) has its own deep dive: [`UNLINKABILITY-PLAN.md`](./UNLINKABILITY-PLAN.md).

---

## ✅ Working (happy path)

Connect wallet · denominations 0.1/1/10 XLM + live anonymity-set indicator · **real 0.1 XLM
payment** (deposit → in-browser Groth16 proof → on-chain withdraw) · full receipt · two
Freighter signatures · on-chain verification · Activity log · Wallet · dashboard home ·
Hermes (`/history`, `/verify`, `/settle`, graceful unknown command) · invalid address
disables the pay button · disconnect → landing · wrong network blocked by Freighter.

---

## 🐛 Findings & fixes

Each finding lists severity, evidence/cause, and the planned fix (file:line where known).

### #2 — [HIGH] ✅ Unlinkability is broken on-chain
Deposit and withdraw are submitted by the **same account**, so payer→publisher is trivially linkable.
- **Evidence (pay to a *different* account, rules out artifact):**
  - Deposit `5494e105…` → source `GAS45G7S`, seq …645
  - Withdraw `2ad32e9a…` → source `GAS45G7S` (same), seq …646, pays `GDRA7`
- **Cause:** `app/lib/pool.ts` → `invoke(server, from, 'withdraw', …)` uses the depositor as tx source. The withdraw args don't include the depositor, so it doesn't actually need their signature.
- **Fix:** route the withdraw through a relayer (different source account). Full plan, conditions, and on-chain acceptance criteria in **[`UNLINKABILITY-PLAN.md`](./UNLINKABILITY-PLAN.md)**.

### #8 — [HIGH] No check that the destination exists
Paying < 1 XLM to a non-existent account fails the withdraw with a raw `HostError #14`
(`"transfer amount is below minimum balance for new account", 1000000, 10000000`). Stellar
needs ≥ 1 XLM to create an account.
- **Fix:** in `app/lib/pool.ts` / `app/components/settle-flow.tsx`, pre-check `server.getAccount(publisher)`; if 404 and the denomination can't create the account, block with a clear message. Production: create new accounts via Sponsored Reserves (CAP-33) through the relayer.

### #9 — [HIGH / fund safety] A failed withdraw strands the deposit
The flow deposits first, withdraws second; a failure/abandon between them locks 0.1 XLM in
the pool and the in-memory note is lost on navigation (tester balance dropped ~0.208 XLM).
- **Fix:** persist the note to storage **before** depositing; pre-flight withdraw preconditions; add a "pending deposits / retry withdraw" surface.

### #1 — [MEDIUM] "Open dashboard →" lands on a broken demo
`app/app/connect/page.tsx:42` does `router.push('/dashboard/pay')` — an out-of-nav, broken demo (see #5).
- **Fix:** push to `/dashboard` (or `/dashboard/settle`). *(one line)*

### #4 — [MEDIUM] "Testnet" badge is hardcoded; wrong network not detected
The UI always shows "Testnet"; on Main Net it only fails at signing time (Freighter catches it, not the app).
- **Fix:** read Freighter's network (`getNetworkDetails()`); show the real network and disable/warn on mismatch.

### #5 + #6 — [MEDIUM] Broken bb.js demo pages
`/dashboard/pay` ("proof could not be generated") and `/dashboard/shield`
("Object.defineProperty called on non-object") use `@aztec/bb.js` (legacy UltraHonk), whose
WASM fails to init. They predate the snarkjs/Groth16 pool pivot, move no value, are out of nav.
- **Fix (recommended):** remove the demos + their bb.js code (`app/app/dashboard/pay`, `app/app/dashboard/shield`, `app/components/pay-flow.tsx`, the bb.js path in `app/lib/proof.ts`). Shrinks dead code and risk surface.

### #3 — [LOW] Wallet balance shown rounded
Shows "10,000" while the real balance is `9999.9854` (fees + payment movement hidden).
- **Fix:** render full decimals in `app/app/dashboard/wallet/page.tsx`.

### #7 — [LOW] Hermes `/history` empty publisher field
`app/components/hermes.tsx:108` renders `domainOf(r.contentUrl)` but the pool flow stores the
destination in `publisherDomain` (`contentUrl` is empty).
- **Fix:** render `r.publisherDomain`. *(one line)*

---

## Suggested order of work
1. **#1, #7** — one-liners, zero risk.
2. **#5/#6** — remove dead demos (shrinks risk surface before judging).
3. **#4, #3** — network detection + balance display.
4. **#8, #9** — fund-safety, folded into the relayer redesign (#2).
5. **#2** — the headline relayer fix (see `UNLINKABILITY-PLAN.md`).

## Pending QA
- Reject the 2nd (withdraw) signature mid-flow — does the UI recover? (relates to #9)
- Double-spend (nullifier) — needs a separate technical test.
- `npm test` (22 Vitest) + `npm run build` baseline.
