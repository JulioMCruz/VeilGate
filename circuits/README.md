# circuits/ — Noir ZK circuit for VeilGate

The zero-knowledge circuit that proves a payment is valid without revealing the amount.

## What it proves

Given private inputs `(secret, nullifier, amount, merkle_path, merkle_indices)` and public
inputs `(commitment, nullifier_hash, publisher_pubkey_(x,y), merkle_root, amount_range_bit)`,
the circuit enforces (every check is a real constraint — none are decorative):

1. **Commitment is well-formed**: `commitment == Pedersen(secret, nullifier, amount)`
2. **Publisher-bound nullifier**: `nullifier_hash == Pedersen(nullifier, pub_x, pub_y)`.
   Folding the publisher pubkey into the nullifier hash binds the spend to one publisher,
   so a proof cannot be replayed to a different publisher, and the spent-set is scoped per
   publisher.
3. **Amount fits in 8 bits**: `amount ∈ [0, 255]` (centi-cents, range proof)
4. **Commitment membership**: a Merkle proof that `commitment` is in the publisher's
   published commitment set, enforced against the public `merkle_root`.

Double-spend is prevented **outside** the circuit: the publisher-bound `nullifier_hash`
is revealed and recorded in a spent-set by the gateway; a second spend of the same note
reproduces the same `nullifier_hash` and is rejected.

## File layout

```
circuits/
├── Nargo.toml          # Package manifest
└── src/
    └── main.nr         # The circuit (fn main) + helpers + inline #[test]s
```

## Public vs private inputs

| Input | Type | Visibility | Purpose |
|---|---|---|---|
| `commitment` | `Field` | public | `Pedersen(secret, nullifier, amount)` |
| `nullifier_hash` | `Field` | public | `Pedersen(nullifier, pub_x, pub_y)` — double-spend tag, publisher-bound |
| `publisher_pubkey_x` | `Field` | public | Binds the spend to one publisher |
| `publisher_pubkey_y` | `Field` | public | (part of the binding) |
| `merkle_root` | `Field` | public | Root of the published **commitment** set |
| `amount_range_bit` | `u8` | public | Must be `1`; asserts "amount is in range" |
| `secret` | `Field` | **private** | Random per-payment |
| `nullifier` | `Field` | **private** | Random per-payment, revealed only as a hash |
| `amount` | `Field` | **private** | Payment amount (hidden on-chain) |
| `merkle_path` | `[Field; 20]` | **private** | Sibling hashes for the membership proof |
| `merkle_indices` | `[u1; 20]` | **private** | Left/right direction bits |

## Range proof (8 bits)

```rust
let bits: [u1; 8] = amount.to_le_bits();
let mut reconstructed: Field = 0;
let mut weight: Field = 1;
for i in 0..8 {
    reconstructed = reconstructed + (bits[i] as Field) * weight;
    weight = weight * 2;
}
assert(reconstructed == amount, "amount not in 8-bit range");
```

`to_le_bits::<8>()` itself constrains the value to 8 bits (it traps on an out-of-range
amount), and the explicit reconstruction is a documented defense-in-depth check.

## Pedersen commitments

Uses Noir's `std::hash::pedersen_hash([x, y, ...])`, a BabyJubJub-based hash over the
BN254 scalar field — the same primitive used by Aztec, Tornado Cash, and most production
privacy protocols.

Source: <https://noir-lang.org/docs/noir/standard_library/cryptographic_primitives/hashes>

## Build & test

### Prerequisites
- [`nargo` (Noir 1.0+)](https://noir-lang.org/docs/getting_started/installation) — tested with `1.0.0-beta.9`
- Optionally: [`bb` (Barretenberg)](https://github.com/AztecProtocol/aztec-packages) for proving

### Test the circuit

```bash
cd circuits
nargo test
```

The 5 tests **execute `main()`** with concrete witnesses (not just helpers):

| Test | Expectation |
|---|---|
| `test_valid_payment_proof_succeeds` | valid witness → satisfies |
| `test_wrong_secret_fails` | wrong opening → `commitment mismatch` |
| `test_replay_to_different_publisher_fails` | swapped pubkey → `nullifier/publisher binding mismatch` |
| `test_out_of_range_amount_fails` | `amount = 256` → rejected |
| `test_wrong_merkle_root_fails` | bad root → `commitment not in published merkle set` |

### Compile the circuit

```bash
cd circuits
nargo compile          # → target/zk_paywall.json (ACIR bytecode)
nargo info             # → ~190 ACIR opcodes for main
```

## On-chain verification — two paths

> **Important (verified June 2026):** Noir proves with **UltraHonk** (Barretenberg), not
> Groth16. The two paths below differ in how this circuit's proof reaches the chain.

1. **UltraHonk (Noir-native, recommended).** Prove with `bb` and verify with an UltraHonk
   Soroban verifier (the Noir-native path the Stellar ZK docs point to). This avoids any
   proof-system conversion. See `contracts/ULTRAHONK_ONCHAIN.md`.

2. **Groth16 (currently deployed).** `contracts/verifier/` is a working Groth16/BN254
   verifier deployed to testnet (`CAW4VAGEOBMQIOVFJD354BXN5O3LRP3GZGMCDEPZDNQKDUN7TZYAR45V`).
   Using it with **this** Noir circuit requires lowering ACIR → Groth16, which is the
   fragile link. The Groth16 verifier is independently correct and proven with a real
   arkworks-generated BN254 vector — see `contracts/verifier/src/test.rs`.

Deciding between (1) and (2) for VeilGate is an open architectural choice tracked in the
project notes.

## Security notes

- This circuit has not been audited. Do not use in production with real funds.
- The **publisher binding** is now enforced (publisher pubkey folded into the nullifier
  hash). A stronger variant would EdDSA-verify a publisher signature inside the circuit.
- The Merkle proof is **commitment membership** (allow-list), depth hardcoded to 20.
  Adjust to match the deployed commitment-set depth.
- 8-bit amount range (`$0.00–$2.55`) is an MVP choice; widening to a Bulletproof-style
  range keeps the same commitment scheme.

## License

MIT
