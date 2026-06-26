# VeilGate — Unlinkability QA & Fix Procedure

> ## 🔎 TL;DR for judges & reviewers
> We stress-tested VeilGate's **core privacy claim directly on-chain — and it leaks.**
> The deposit and the withdraw are submitted by the **same Stellar account**, so anyone can
> link **payer → publisher** in seconds (verified on Horizon with two independent payments,
> including one to a third party). The ZK proof is sound; the leak is in the **transaction
> layer** (the withdraw's `source_account`).
>
> This folder documents the finding with reproducible on-chain evidence **and** a concrete
> fix — [`RESTORING-THE-VEIL.md`](./RESTORING-THE-VEIL.md) — that severs the link by routing
> the withdraw through a relayer, with **verifiable on-chain acceptance criteria** (not just a
> claim). Finding a privacy break in your own headline feature, proving it, and shipping a
> measurable fix is the kind of adversarial self-review real ZK systems need.

This folder is both a record of what was tested and a template for how we triage and fix
privacy-critical issues on VeilGate.

## Contents

| File | What it is |
|---|---|
| [`QA-FINDINGS.md`](./QA-FINDINGS.md) | Full Phase-1 QA report: what works, 9 findings (3 high), and what's still pending. Every on-chain claim verified against Horizon testnet. |
| [`RESTORING-THE-VEIL.md`](./RESTORING-THE-VEIL.md) | The headline fix for finding #2: a relayer-submitted withdraw (Option B), the conditions required to *actually* achieve unlinkability, and on-chain acceptance criteria. |
| [`SECONDARY-FIXES.md`](./SECONDARY-FIXES.md) | Scoped fixes for the remaining findings (#1, #3–#9): fund-safety, network detection, dead-demo removal, and polish — with files, line numbers, and effort estimates. |

## The procedure we followed

1. **Run the app locally** against testnet (`cd app && npm run dev`) with the Freighter wallet on Test Net and a friendbot-funded account.
2. **Exercise the real flow** end-to-end (deposit → in-browser Groth16 proof → on-chain withdraw) plus dashboard, wallet, activity, Hermes, and negative cases.
3. **Verify on-chain, independently.** For every claim, query Horizon testnet directly (transaction `source_account`, sequence, success, account existence, balances) instead of trusting the UI.
4. **Log findings with evidence and severity.** Each finding records exact repro steps, the offending file/line, the on-chain evidence, and a suggested fix.
5. **Root-cause in code**, not just symptoms (e.g. #2 traced to `invoke(server, from, 'withdraw', …)` in `app/lib/pool.ts`).
6. **Propose a fix and gate it on approval.** Write a concrete plan with a trust model and acceptance criteria; only branch + PR after sign-off.

## Headline finding (#2)

What an on-chain observer sees today:

```
05:54:00 — GAS45 deposits 0.1 XLM into the pool      (source = GAS45)
05:54:15 — GAS45 withdraws and pays 0.1 XLM to GDRA7 (source = GAS45)
```

Same source account + consecutive sequence + ~15 s apart → the depositor → publisher link
is trivial, which is exactly what the pool is meant to hide. The ZK proof is sound; the leak
is in the Stellar transaction layer. See `FIX-PLAN.md` for the fix.

## Reproducing the QA

```bash
cd app
npm install
cp .env.example .env.local   # public testnet config only — no secrets
npm run dev                  # http://localhost:3000
```

- Freighter on **Test Net**, funded via `https://friendbot.stellar.org/?addr=<G_PUBLIC_KEY>`.
- Verify any tx on Horizon: `https://horizon-testnet.stellar.org/transactions/<HASH>`.
- Inspect visually on stellar.expert (testnet).

## Status & next steps

- QA: Phase 1 complete (9 findings logged; some technical checks pending — see `QA-FINDINGS.md`).
- Fix #2: **awaiting Julio's approval** (see `FIX-PLAN.md` §10). If approved → branch `fix/unlinkable-withdraw-relayer` + PR. If not → handed to Julio's agents.

## Working rules

- Work on a feature branch; **never** merge directly to `main`; open a PR.
- **No secrets** committed — relayer keys are server-side env only; use placeholders (`<RELAYER_SECRET>`, `<CONTRACT_ID>`) in docs.
- Phase 1 = functional QA. Phase 2 = frontend / visual polish.
