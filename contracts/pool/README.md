# contracts/pool — VeilGate shielded pool (real on-chain settlement)

The contract that makes the payment **actually move value on testnet**. A
fixed-denomination shielded pool: real tokens move; the link between a payment
and its deposit stays private (unlinkable); the per-note amount is the public fixed denomination.

## Interface

| Function | What it does |
|---|---|
| `__constructor(token, denom, vk_alpha, vk_beta, vk_gamma, vk_delta, vk_ic)` | Set token (SAC), fixed denomination, and the withdraw circuit's VK; init the on-chain tree |
| `deposit(from, commitment) -> u32` | Pull `denom` of the token from `from`, insert `commitment` into the on-chain Merkle tree (**recomputes the root**), return leaf index |
| `withdraw(proof_a, proof_b, proof_c, root, nullifier_hash, recipient)` | Verify the Groth16 proof on-chain against a recent root, ensure the nullifier is unspent, transfer `denom` to `recipient`. The proof's recipient field is **derived from `recipient` on-chain** (`sha256(strkey)`), binding the proof to who gets paid |
| `is_known_root(root) -> bool`, `is_spent(nullifier_hash) -> bool`, `current_root() -> BytesN<32>` | Views |

There is **no `push_root` / admin** — the contract anchors the root itself (see Trust model).

Withdraw runs the Groth16/BN254 pairing check inline via the native host functions
(`g1_mul`, `g1_add`, `pairing_check`) — the only ZK path that fits the testnet per-tx budget.

## Verified on testnet (real payment)

Deployed and exercised end-to-end on Stellar testnet:

- Pool: `CDZGIFZFRFKYIMSPBLA2OSFVD5RIUVVVWRVN5LPAHYHDGH6LOEGKGD7H`
- Token: native XLM SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- Denomination: `1_000_000` stroops (0.1 XLM)

```
deposit(commitment)                  -> 0.1 XLM pulled in; root recomputed ON-CHAIN
                                        (== prover's root, no operator)
withdraw(proof, …, ATTACKER)         -> Error(Contract, #3) ProofInvalid  (front-run blocked;
                                        proof is bound to the recipient — nullifier NOT spent)
withdraw(proof, …, publisher)        -> proof verified on-chain, 0.1 XLM paid to publisher
publisher balance                    -> 10000.2  ->  10000.3 XLM   (+0.1, real)
re-withdraw same nullifier           -> Error(Contract, #2) NullifierSpent  (double-spend blocked)
```

## Reproduce

```bash
# 1. circuit artifacts + a note/proof (see ../../pool)
cd pool && npm install && npm run build:circuit
node scripts/pool_demo.mjs            # writes /tmp/pool_demo.env (proof, commitment, root, …)

# 2. build + deploy the pool with the VK
cd ../contracts && stellar contract build
stellar contract deploy --wasm target/wasm32v1-none/release/pool.wasm --source <key> --network testnet -- \
  --token <token SAC> --denom 1000000 \
  --vk_alpha <hex> --vk_beta <hex> --vk_gamma <hex> --vk_delta <hex> --vk_ic '[<hex>,…]'

# 3. deposit (recomputes the root on-chain) -> withdraw (values from /tmp/pool_demo.env)
```

## Trust model — TRUSTLESS

The pool maintains an **on-chain incremental Merkle tree with a recent-root history**
(`merkle.rs`). On every `deposit` the contract **recomputes the root itself** using the
native Poseidon host function via `env.crypto_hazmat()` (feature `hazmat-crypto`) —
bit-for-bit compatible with the circuit's Poseidon (validated). So:

- **No operator, no off-chain trust.** The root is anchored to real deposits by the contract.
- `withdraw` accepts a proof against any of the last `ROOT_HISTORY` (30) roots.
- **Recipient-bound proofs.** The third public input is derived on-chain from `recipient`
  (`sha256(strkey)`, top byte zeroed so it is < the BN254 scalar field). The browser binds the
  identical value into the proof, so a front-runner who swaps in a different `recipient`
  invalidates the proof (verified on testnet: `Error #3 ProofInvalid`, nullifier not spent).

The earlier admin-anchored variant is removed.

Trustless pool: `CDZGIFZFRFKYIMSPBLA2OSFVD5RIUVVVWRVN5LPAHYHDGH6LOEGKGD7H`
