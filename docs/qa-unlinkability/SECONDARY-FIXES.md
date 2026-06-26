# Secondary Fixes — VeilGate QA (everything except #2)

> Companion to `RESTORING-THE-VEIL.md` (the headline privacy fix for #2).
> These are the remaining findings from `QA-FINDINGS.md`, each with a concrete, scoped fix.
> Nothing here is implemented yet — this is the plan, gated on approval. Branch + PR only, never `main`.

Ordered by severity, then by effort.

---

## Fund safety (HIGH)

### #8 — Reject / warn on a non-existent destination
- **File:** `app/lib/pool.ts` (`payPrivately`) + `app/components/settle-flow.tsx` (validation).
- **Fix:** before the deposit, look up the destination (`server.getAccount(publisher)`):
  - If it returns 404 (account does not exist) **and** the chosen denomination is below the 1 XLM account-creation minimum (i.e. 0.1 XLM), block the flow with a clear message ("This account doesn't exist yet; paying it requires at least 1 XLM to create it, or fund it first via friendbot").
  - Optional production path: use **Sponsored Reserves (CAP-33)** via the relayer to create the destination so sub-1-XLM payouts to new accounts work.
- **Why:** today this surfaces a raw `HostError: Error(Contract, #14)` after funds were already deposited (see #9).
- **Effort:** ~1–2 h (validation) / +0.5 day (sponsored reserves).

### #9 — Don't lose funds when the withdraw fails
- **File:** `app/lib/pool.ts`, `app/components/settle-flow.tsx`.
- **Fix:**
  1. **Persist the note** (`secret`, `nullifier`, `commitment`, pool, recipient) to local storage *before* the deposit, so a failed/abandoned withdraw can be retried instead of stranding the deposit.
  2. **Pre-flight the withdraw** (destination check #8, anonymity-set check) *before* depositing.
  3. Add a **"pending deposits / retry withdraw"** UI surface that lists notes whose withdraw hasn't completed.
- **Why:** the flow deposits first and withdraws second; a failure between the two locks 0.1 XLM in the pool and the in-memory note is lost on navigation.
- **Effort:** ~0.5 day.

---

## UX & correctness (MEDIUM)

### #1 — "Open dashboard →" should not land on a broken demo
- **File:** `app/app/connect/page.tsx:42`.
- **Fix:** change `router.push('/dashboard/pay')` → `router.push('/dashboard')` (home) or `'/dashboard/settle'` (real flow).
- **Effort:** 1 line.

### #4 — Detect the wallet network instead of hardcoding "Testnet"
- **File:** wallet provider (`app/lib/providers/…`) + the network badge component.
- **Fix:** read Freighter's active network (`getNetworkDetails()` / `getNetwork()` from `@stellar/freighter-api`); show the real network and, if it isn't testnet, warn and disable the pay button before signing.
- **Why:** today the badge always says "Testnet"; a user on Main Net only finds out at signing time (Freighter catches it, not the app).
- **Effort:** ~2–3 h.

### #5 + #6 — Remove (or fix) the broken bb.js demo pages
- **Files:** `app/app/dashboard/pay/`, `app/app/dashboard/shield/`, `app/components/pay-flow.tsx`, the `@aztec/bb.js` path in `app/lib/proof.ts`.
- **Fix (recommended): remove** the `/dashboard/pay` and `/dashboard/shield` demos and their bb.js/UltraHonk code. They predate the pivot to the snarkjs/Groth16 pool flow, move no value, are out of nav, and currently throw (`/pay`: "proof could not be generated"; `/shield`: "Object.defineProperty called on non-object"). Removing them deletes dead code and a risk surface for judges.
- **Alternative:** fix bb.js WASM initialization if a real "pre-mint / shield" demo is wanted — but note the time-decorrelation value of a real shield flow is better served by the pool redesign in `RESTORING-THE-VEIL.md` §4.
- **Effort:** ~1–2 h (removal).

---

## Polish (LOW)

### #3 — Show the real balance, not a rounded figure
- **File:** `app/app/dashboard/wallet/page.tsx` (balance render).
- **Fix:** display the full balance with appropriate decimals (e.g. `9999.9854 XLM`) instead of rounding to `10,000`, so fee/payment movement is visible.
- **Effort:** ~30 min.

### #7 — Hermes `/history` empty publisher field
- **File:** `app/components/hermes.tsx:108`.
- **Fix:** render `r.publisherDomain` instead of `domainOf(r.contentUrl)` (the pool flow stores the destination in `publisherDomain`; `contentUrl` is empty).
- **Effort:** 1 line.

---

## Suggested order of work
1. **#1, #7** — one-liners, zero risk, immediate polish.
2. **#5/#6** — remove dead demos (shrinks risk surface before judging).
3. **#4, #3** — network detection + balance display.
4. **#8, #9** — fund-safety; ideally folded into the same relayer redesign as #2 (`RESTORING-THE-VEIL.md`).
