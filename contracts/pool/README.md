# contracts/pool — VeilGate shielded pool (real on-chain settlement)

The contract that makes the payment **actually move value on testnet**. Fixed-denomination
shielded pool (Tornado / Privacy-Pools style): real tokens move; the link between a payment
and its deposit stays private (unlinkable); the per-note amount is the public fixed denomination.

## Interface

| Function | What it does |
|---|---|
| `__constructor(admin, token, denom, vk_alpha, vk_beta, vk_gamma, vk_delta, vk_ic)` | Set token (SAC), fixed denomination, admin, and the withdraw circuit's VK |
| `deposit(from, commitment) -> u32` | Pull `denom` of the token from `from`, register `commitment`, return leaf index |
| `push_root(root)` | Admin publishes a Merkle root (tree built off-chain from `deposit` events) |
| `withdraw(proof_a, proof_b, proof_c, root, nullifier_hash, recipient_field, recipient)` | Verify the Groth16 proof on-chain, ensure the nullifier is unspent, transfer `denom` to `recipient` |
| `is_root(root) -> bool`, `is_spent(nullifier_hash) -> bool` | Views |

Withdraw runs the Groth16/BN254 pairing check inline via the native host functions
(`g1_mul`, `g1_add`, `pairing_check`) — the only ZK path that fits the testnet per-tx budget.

## Verified on testnet (real payment)

Deployed and exercised end-to-end on Stellar testnet:

- Pool: `CBAF7SJIQMDEU35NVAZ5TJUH574R2ZC545URGBCDAOLY6YEMFJQNZXAH`
- Token: native XLM SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- Denomination: `1_000_000` stroops (0.1 XLM)

```
deposit(commitment)                  -> 0.1 XLM pulled into the pool (leaf 0)
push_root(root)                      -> root published by admin
withdraw(proof, …, publisher)        -> proof verified on-chain, 0.1 XLM paid to publisher
publisher balance                    -> 10000.0  ->  10000.1 XLM   (+0.1, real)
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
  --admin <addr> --token <token SAC> --denom 1000000 \
  --vk_alpha <hex> --vk_beta <hex> --vk_gamma <hex> --vk_delta <hex> --vk_ic '[<hex>,…]'

# 3. deposit -> push_root -> withdraw (values from /tmp/pool_demo.env)
```

## Trust model & roadmap

MVP: the admin publishes Merkle roots (the tree is built off-chain from on-chain `deposit`
events). Real value, real ZK gate, real double-spend protection; the residual trust is that
the admin publishes a root over the genuine deposit set.

Fully trustless variant recomputes the root **on-chain** with the circuit's hash. The native
Soroban Poseidon (`poseidon_permutation`) is parameterizable to match the circuit, but its
`CryptoHazmat` constructor is not yet publicly exposed in the SDK — so the on-chain tree (or a
pure-Rust MiMC tree matching a MiMC circuit) is the next step.
