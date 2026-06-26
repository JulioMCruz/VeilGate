# Fix Plan — Finding #1 (broken unlinkability)

> Discussion document. Related: `QA-AND-FIXES.md` #1 (and #8/#9).
> **Wallet decision:** we keep **Freighter**. No passkeys / account abstraction are required to fix privacy.

## 1. The problem (recap)

VeilGate's privacy depends on **no one being able to link the depositor to the publisher** who gets paid. Today it breaks because the **deposit and the withdraw come from the same account (the depositor's)**:

```
05:54:00 — GAS45 deposits 0.1 XLM into the pool      (source = GAS45)
05:54:15 — GAS45 withdraws and pays 0.1 XLM to GDRA7 (source = GAS45)  ← same source
```

Same `source_account`, consecutive sequence numbers, ~15 s apart. Anyone correlates depositor → publisher in seconds. Confirmed with two distinct payments (including one to a third party).

## 2. Root cause (in code)

In `app/lib/pool.ts`, `payPrivately()` calls `invoke(server, from, poolId, 'withdraw', [...])`, and `invoke()` uses `from` (the depositor's account) as the **transaction source** and signs it with Freighter.

**Key detail:** the `withdraw` arguments are `[pi_a, pi_b, pi_c, root, nullifierHash, recipient]` — **the depositor's address is not there**. The withdraw is authorized by the **Groth16 proof + nullifier + root + recipient binding**; the fund transfer is authorized by the **pool contract itself** (it holds the XLM). Therefore:

> **The withdraw does not require the depositor's signature. Any account can submit it.** The depositor shows up as the source only because of how `invoke()` is built.

## 3. The fix (chosen approach)

Decouple **who submits the withdraw** from **who deposited**:

- **Deposit:** still signed by **Freighter** from the user's account. (A deposit coming from your account is fine: the whole anonymity set deposits; the deposit does not reveal who you pay.)
- **Withdraw:** built and submitted by a **separate submitter** (its account is the `source`, it pays the fee). The browser generates the proof (the secret never leaves the device) and sends only `{proof, root, nullifierHash, recipient}` to the submitter.

On-chain result:
```
GAS45   deposits into the pool       (source = GAS45)
RELAYER withdraws and pays GDRA7     (source = RELAYER)   ← no link to GAS45
```

### Chosen option: **B — own relayer** (for a verifiable demo)

We implement **Option B** because it is the only one **we can build and demonstrate end-to-end** to actually prove unlinkability. Option A (publisher submits) is the production evolution but depends on infrastructure we don't control in a demo.

| Option | Who submits the withdraw | Use |
|---|---|---|
| **A** — Publisher submits | the publisher's server (source = publisher) | **production** of the paywall use case; no central infra of ours, but requires the publisher to run a submit endpoint |
| **B** — Own relayer ✅ | a small service of ours, from a funded relayer account | **chosen** — demoable end-to-end, works for any recipient |
| C — Launchtube | Stellar's hosted Soroban submission service | minimal infra, but external dependency + API key |

## 4. Making the unlinkability *real* (necessary conditions)

Moving the source account is **necessary but not sufficient**. All of the following must hold for the property to actually be achieved:

1. **Different source account.** Withdraw `source_account` = relayer, never the depositor. *(the core fix)*
2. **No depositor-identifying data in the withdraw.** Already true — the depositor's address is not an argument, and the request to the relayer must not include it (it isn't needed).
3. **Minimum anonymity set.** If a pool has only your deposit, you're trivially linked. Gate the withdraw (refuse or clearly warn) until the pool has at least `k` deposits (e.g. `k ≥ 5`). Surface the live set size (already shown in the UI).
4. **Time decorrelation.** A single deposit followed by a single withdraw seconds later is correlatable even across different source accounts. Mitigate with: a randomized delay, and/or **decoupling deposit from withdraw in time** — i.e. make the "shield" model real (pre-deposit notes now, withdraw later when the set is larger).
5. **Relayer hygiene.** The relayer must not log `IP ↔ recipient`; must rate-limit (anti-DoS); must keep its signer key **server-side only**; and must not also be the deposit RPC/observer (otherwise it can correlate both legs).
6. **Network metadata.** The same browser performs the deposit (to RPC) and the withdraw request (to the relayer). An adversary observing both could correlate by IP/timing. Acceptable as a documented residual for the demo; for production, separate the paths and/or add delay.

## 5. What an on-chain observer sees after the fix

- deposit: `userAccount → pool` (commitment `C`), denomination D, time T1
- withdraw: `relayer → recipient` (nullifier `N`), denomination D, time T2

No on-chain field links `C ↔ N` (that is the ZK property), there is no shared source account, and the denomination is identical across the whole set. Any remaining link requires **off-chain correlation** (timing / IP), which conditions 3–6 address.

## 6. Acceptance criteria (how we verify on-chain)

A fix is accepted only when, verified on Horizon:
- [ ] `deposit.source_account ≠ withdraw.source_account` for every payment.
- [ ] `withdraw.source_account == <relayer address>` (a fixed account shared by many payments).
- [ ] No argument, memo, or event in the withdraw references the depositor.
- [ ] Withdraw is rejected/warned when the pool's anonymity set is below `k`.
- [ ] Scenario test: with ≥ 2 users depositing the same denomination in an overlapping window, an observer cannot match depositor → payout better than chance.

## 7. Trust model

- ✅ **Theft:** impossible — the proof is bound to the `recipient`; a swapped recipient invalidates the proof. The relayer only pays the fee and pushes the tx.
- ⚠️ **Censorship/liveness:** the relayer can refuse to submit (it cannot steal). Mitigate with multiple relayers and/or a fallback to user self-submit (which degrades privacy but still completes the payment).
- ⚠️ **Relayer knowledge:** the relayer sees `recipient + timing`, not the depositor.

## 8. Code changes (Option B)

- `app/lib/pool.ts`: split `payPrivately`.
  - `deposit` → unchanged, via Freighter.
  - after proving → `POST /api/relay-withdraw` with `{ proofParts, root, nullifierHash, recipient }` instead of `invoke(server, from, 'withdraw', …)`.
- New `app/api/relay-withdraw/route.ts`: builds `invokeContractFunction('withdraw', …)` with the **relayer account as source**, `prepareTransaction`, signs with the relayer secret, `sendTransaction`, returns `withdrawHash`.
- **Secrets:** the relayer signer key lives **server-side only** (e.g. `RELAYER_SECRET`, never `NEXT_PUBLIC_*`, never committed — use a placeholder `<RELAYER_SECRET>` in docs/`.env.example`).
- The **pool contract does not change** (it already verifies proof + recipient binding and does not require the depositor's auth).
- UI: add the anonymity-set gate (condition 3).
- Optional, same redesign: persist the note (addresses #9); use Sponsored Reserves / pre-check destination (addresses #8).

## 9. Effort estimate (Option B, demo)

- Relayer endpoint + `pool.ts` refactor: ~0.5–1 day.
- Funded relayer account on testnet + server-side env var: minutes.
- Anonymity-set gate + optional delay (timing mitigation): incremental.

## 10. Open decisions

1. Fix #1 via **Option B (own relayer)** for now, with **Option A** as the production path?
2. Any constraints on running a relayer account (funding, hosting)?
3. Lands on branch `fix/unlinkable-withdraw-relayer` → PR for review before any merge.
