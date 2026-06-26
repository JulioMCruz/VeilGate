# VeilGate — QA Findings (Phase 1)

Manual QA of `app/` running locally (`http://localhost:3000`) against **Stellar testnet**, using the Freighter wallet.
Phase 1 = functional QA. Phase 2 = frontend / visual polish.

- Tester wallet: `GAS45G7S…56MX6BU5` (funded with 10,000 XLM via friendbot).
- Second destination used to rule out a "pay-to-self" artifact: `GDRA7SYF…W5O53U`.
- All transaction claims below were independently verified against Horizon testnet.

---

## ✅ Working (happy path)

| Item | Result |
|---|---|
| Connect wallet (shows address) | ✅ |
| Settle screen: denominations 0.1 / 1 / 10 XLM + "deposits in pool" indicator | ✅ |
| **Real 0.1 XLM payment** (deposit → in-browser Groth16 proof → on-chain withdraw) | ✅ |
| Full receipt (deposit tx, withdraw tx, pool, nullifier, root, 256-byte proof, anonymity set) | ✅ |
| Two Freighter signatures (deposit + withdraw) | ✅ |
| On-chain verification (both txs Successful on Horizon) | ✅ |
| Activity / transaction log shows the payment | ✅ |
| Wallet: shows address, network, balance, explorer link, friendbot | ✅ (see #3) |
| Dashboard home: live pools, "how it works", recent payments, use cases | ✅ |
| Hermes `/history`, `/verify` (usage), `/settle`, `/asdfg` (graceful error) | ✅ |
| Invalid address → "Deposit & pay privately" button disabled | ✅ |
| Disconnect → returns to landing | ✅ |
| Wrong network → Freighter blocks signing | ✅ (but see #4) |

---

## 🐛 Findings

### #2 — [HIGH] ✅ CONFIRMED — Unlinkability is broken on-chain: deposit and withdraw share the same source account
- **Where:** settle flow / on-chain.
- **Evidence 1 (pay-to-self):**
  - Deposit `67c3fc5b…cf2567` → source `GAS45G7S…56MX6BU5`, seq …**641**
  - Withdraw `a8d42cad…4e78cd` → source `GAS45G7S…56MX6BU5`, seq …**642**
  - Same account, consecutive sequence, 15 s apart, same pool.
- **Evidence 2 (pay to a DIFFERENT account `GDRA7SYF…`) — rules out a pay-to-self artifact:**
  - Deposit `5494e105…81628f` → source `GAS45G7S`, seq …**645**, `deposit(...) → 7u32`
  - Withdraw `2ad32e9a…3e7e29` → source `GAS45G7S`, seq …**646** (consecutive), pays `GDRA…O53U`, signed only by `GAS45`
  - The withdraw is always signed/submitted by the depositor's account, regardless of recipient. Same source + consecutive sequence + 15 s apart → trivial correlation.
- **What an observer sees:**
  ```
  05:54:00 — GAS45 deposits 0.1 XLM into the pool   (source = GAS45)
  05:54:15 — GAS45 withdraws and pays 0.1 XLM to GDRA7 (source = GAS45)
  ```
- **Why:** in `app/lib/pool.ts`, `payPrivately()` calls `invoke(server, from, 'withdraw', …)` and `invoke()` uses `from` (the depositor) as the transaction source. The ZK proof is valid; the leak is in the **Stellar transaction layer** (the withdraw's `source_account`).
- **Impact:** this is the project's core value proposition — the first thing a ZK hackathon judge will check. See `FIX-PLAN.md`.

### #8 — [HIGH] No check that the destination exists; a sub-1-XLM payment to a non-existent account blows up the withdraw
- **Repro:** settle → publisher = `GDRA7SYF…` (an **unfunded** account, 404 on Horizon) → 0.1 XLM → Pay.
- **Raw error surfaced in UI:** `HostError: Error(Contract, #14)` with event `"transfer amount is below minimum balance for new account", 1000000, 10000000`.
- **Cause:** creating a new account on Stellar requires ≥ 1 XLM (10,000,000 stroops). The withdraw transfers 0.1 XLM (1,000,000) to a non-existent account → below minimum → fails.
- **Suggestion:** before depositing, check whether the destination exists on-chain and whether the chosen amount can create it; show a clear message instead of the raw `HostError`.

### #9 — [HIGH / fund safety] A failed withdraw leaves the deposit stuck in the pool (funds potentially unrecoverable)
- **What:** the flow signs **deposit first**, **withdraw second**. If the withdraw fails (#8) or the page is left mid-flow, the **deposit already executed** → 0.1 XLM stays in the pool. The note (secret) lives only in the tab, so navigating away **loses it**, likely making those funds unrecoverable.
- **Evidence:** tester balance dropped 9999.9854 → 9999.7770 (~0.208 XLM) from ~2 stuck deposits (an abandoned attempt + the failed withdraw in #8).
- **Suggestion:** (a) verify withdraw preconditions **before** depositing; (b) persist the note so the withdraw can be retried; (c) a recovery UI for pending deposits.

### #1 — [MEDIUM] "Open dashboard →" lands on a broken demo
- **Where:** `app/app/connect/page.tsx:42`.
- **What:** the "Open dashboard →" button does `router.push('/dashboard/pay')`, which is an **out-of-nav demo** (moves no value) and is **broken** (see #5). It should go to `/dashboard` (home) or `/dashboard/settle` (the real payment flow).

### #4 — [MEDIUM] The "Testnet" badge is hardcoded; the app does not detect the wrong network
- **Where:** header / dashboard ("● Testnet" badge).
- **What:** the UI always shows "Testnet" regardless of Freighter's actual network. With Freighter on **Main Net**, the app lets you proceed and only fails at signing time (Freighter catches it: *"Freighter is set to Main Net…"*), not the app.
- **Suggestion:** detect the wallet network and warn proactively if it doesn't match testnet.

### #5 — [MEDIUM] Demo `/dashboard/pay` fails to generate the proof
- **Repro:** `/dashboard/pay` → URL `youtube.com` → "Pay" → *"Something went wrong. The proof could not be generated."*
- **Cause:** it uses `@aztec/bb.js` (UltraHonk), a different proving stack than the real flow (snarkjs/Groth16). bb.js's WASM fails to initialize in the browser (see #6). Stale demo page, predating the pivot to the pool.

### #6 — [MEDIUM] Demo `/dashboard/shield` crashes with a raw error
- **Repro:** `/dashboard/shield` → amount 64 centi-cents → "Generate shield commitment" → *"Object.defineProperty called on non-object"*.
- **Cause:** same root as #5 — `@aztec/bb.js` (`Barretenberg.new` / `pedersenHash` in `lib/proof.ts`) fails to init its WASM. Here the raw error leaks to the UI.

### #3 — [LOW] Wallet balance is shown rounded
- **What:** Wallet shows "10,000" XLM; the real on-chain balance is **9999.9853810** (~0.0146 XLM spent on fees; the 0.1 round-tripped because of pay-to-self). Display rounding hides that movement happened.

### #7 — [LOW / cosmetic] Hermes `/history` shows an empty publisher field
- **What:** output is `•  · 20c4227dff91… · deposit↔payment: unlinkable` — an empty field before the nullifier (missing domain/publisher).
- **Cause:** `app/components/hermes.tsx:108` renders `domainOf(r.contentUrl)`, but the pool flow (`settle-flow.tsx:96`) stores `contentUrl: ''` and puts the destination in `publisherDomain`. Leftover from the "pay a URL" → pool pivot.
- **Fix:** use `r.publisherDomain` instead of `domainOf(r.contentUrl)`.

---

## ℹ️ Notes (not bugs)
- On the home page, the "Proof it works on-chain" section shows **hardcoded** sample hashes (`36972c83…` / `8b4a9180…`), different from the user's. It's a static showcase, not a real tester payment.
- The `/pay` and `/shield` demos use bb.js/UltraHonk (legacy stack); the real flow uses snarkjs/Groth16. Consider **removing the demos** or fixing bb.js — they are risk surface for judges.

---

## ⏳ QA still pending
- Reject the **2nd signature** (withdraw) mid-flow: does the UI recover? (related to #9)
- **Double-spend**: the nullifier should block reusing a note — hard to trigger from the UI (each payment generates a fresh note). Needs a separate technical test.
- Denominations **1 and 10 XLM** (optional; the mechanism is already validated with 0.1).
- `npm test` (22 Vitest) and `npm run build` — automated baseline.
