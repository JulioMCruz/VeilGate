# contracts/ — VeilGate Soroban smart contracts (Rust)

The on-chain side of VeilGate. Two crates in a Cargo workspace:

| Crate | What it is |
|---|---|
| [`pool/`](pool/) | **The live shielded pool.** Holds funds, maintains an on-chain Merkle tree (recomputed with native Poseidon — no operator), and verifies a Groth16 proof inline before paying the publisher. This is what the app talks to. |
| [`verifier/`](verifier/) | A standalone Groth16/BN254 verifier (Protocol 25 host functions). Reference / earlier verifier; the pool now verifies inline. |

Privacy model: the pool gives **unlinkability** — an on-chain observer cannot link a deposit to the
payout, and the publisher never learns the payer's wallet. The amount is the pool's **public**
fixed denomination; privacy comes from the anonymity set of equal-size deposits (not from hiding the
number).

## Deployed on Stellar testnet

All real, all verifiable on a block explorer (stellar.expert). Settlement token is **native XLM**.

| What | Denomination | Address |
|---|---|---|
| Shielded pool | 0.1 XLM (`1_000_000`) | `CDZGIFZFRFKYIMSPBLA2OSFVD5RIUVVVWRVN5LPAHYHDGH6LOEGKGD7H` |
| Shielded pool | 1 XLM (`10_000_000`) | `CBIIKKJHZKA77YWXIITCUX6HFVEWIZAJYKO2Q6ZL3SJ3ZTFUY4RESJ2Z` |
| Shielded pool | 10 XLM (`100_000_000`) | `CB27XGZ53S3WGDJE3MN3EHKPBXAMELAK7NY5ZD42ES7ZSLMF7AHTC57E` |
| Token (native XLM SAC) | — | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Standalone Groth16 verifier | — | `CAW4VAGEOBMQIOVFJD354BXN5O3LRP3GZGMCDEPZDNQKDUN7TZYAR45V` |

Inspect any of them on-chain:
`https://stellar.expert/explorer/testnet/contract/<address>` — every deposit and withdrawal is a
real transaction recorded there.

Each denomination is a **separate instance of the same `pool` contract** (identical code +
verification key, only the fixed `denom` differs) — mixing only ever happens within a denomination,
which is what keeps each anonymity set meaningful.

## What the pool guarantees (verified on testnet)

- **Trustless root** — `deposit` recomputes the Merkle root on-chain with the native Poseidon
  (`env.crypto_hazmat()`), so the root is anchored to real deposits with no operator.
- **Recipient-bound proofs** — the proof's recipient field is derived on-chain from the `recipient`
  (`sha256(strkey)`); a front-runner who swaps the recipient gets `ProofInvalid`.
- **No double-spend** — the nullifier is recorded on `withdraw`; replaying it gives `NullifierSpent`.
- **Recent-root history** — a proof verifies against any of the last 30 roots.

See [`pool/README.md`](pool/README.md) for the interface and the exact testnet transcript.

## Build / test / deploy

```bash
# build all contracts to wasm
stellar contract build

# run the pool unit tests (native Poseidon vector, deposit/withdraw, front-run,
# double-spend, unknown-root, root history)
cargo test -p pool        # 7 tests

# deploy one pool (one per denomination); VK comes from pool/scripts/pool_demo.mjs
stellar contract deploy --wasm target/wasm32v1-none/release/pool.wasm --source <key> --network testnet -- \
  --token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC --denom 1000000 \
  --vk_alpha <hex> --vk_beta <hex> --vk_gamma <hex> --vk_delta <hex> --vk_ic '[<hex>,…]'
```

Toolchain: Rust + `soroban-sdk` 26 (native **BN254** + **Poseidon** host functions, Protocol 25).
