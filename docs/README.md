# VeilGate — QA & Unlinkability Fix

> ## 🔎 TL;DR
> We stress-tested VeilGate's **core privacy claim directly on-chain — and it leaks.**
> The deposit and the withdraw are submitted by the **same Stellar account**, so anyone can
> link **payer → publisher** in seconds (verified on Horizon with two independent payments,
> including one to a third party). The ZK proof is sound; the leak is in the **transaction
> layer** (the withdraw's `source_account`).
>
> We then designed and are implementing a fix that **severs the link** by routing the withdraw
> through a relayer, with **verifiable on-chain acceptance criteria** — not just a claim.

## Contents

| File | What it is |
|---|---|
| [`QA-AND-FIXES.md`](./QA-AND-FIXES.md) | Phase-1 QA report: what works + all 9 findings, each with its planned fix. On-chain verified vs Horizon testnet. |
| [`UNLINKABILITY-PLAN.md`](./UNLINKABILITY-PLAN.md) | Deep dive on finding #1: the relayer-based fix, the conditions required to *actually* achieve unlinkability, the trust model, and on-chain acceptance criteria. |

## The headline finding (#1)

What an on-chain observer sees today:

```
05:54:00 — GAS45 deposits 0.1 XLM into the pool      (source = GAS45)
05:54:15 — GAS45 withdraws and pays 0.1 XLM to GDRA7 (source = GAS45)
```

Same source account + consecutive sequence + ~15 s apart → the depositor → publisher link is
trivial, which is exactly what the pool is meant to hide.

## Status

- **QA:** Phase 1 complete (9 findings; some technical checks pending — see `QA-AND-FIXES.md`).
- **Fixes:** in progress on branch `fix/unlinkable-withdraw-relayer` → PR for review.

## Reproducing the QA

```bash
cd app
npm install
cp .env.example .env.local   # public testnet config only — no secrets
npm run dev                  # http://localhost:3000
```

- Freighter on **Test Net**, funded via `https://friendbot.stellar.org/?addr=<G_PUBLIC_KEY>`.
- Verify any tx: `https://horizon-testnet.stellar.org/transactions/<HASH>` (or stellar.expert, testnet).

## Working rules

- Feature branch only; **never** commit to `main`; changes land via PR.
- **No secrets** committed — relayer keys live in server-side env only; docs use placeholders (`<RELAYER_SECRET>`, `<CONTRACT_ID>`).
- Phase 1 = functional QA & fixes. Phase 2 = frontend / visual polish.
