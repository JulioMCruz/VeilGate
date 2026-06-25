# circuits/ — Noir ZK circuit for VeilGate

The zero-knowledge circuit that proves a payment is valid without revealing the amount.

## What it proves

Given private inputs `(secret, nullifier, amount)` and public inputs
`(commitment, nullifier_hash, publisher_pubkey, merkle_root, amount_range_bit)`:

1. **Commitment is well-formed**: `commitment == Pedersen(secret, nullifier, amount)`
2. **Nullifier is well-formed**: `nullifier_hash == Pedersen(nullifier)`
3. **Publisher binding**: commitment is bound to a specific publisher pubkey
4. **Amount fits in 8 bits**: `amount ∈ [0, 255]` (centi-cents, range proof)
5. **Nullifier not spent**: Merkle proof against the published spent-set

## File layout

```
circuits/
├── Nargo.toml          # Package manifest
├── src/
│   └── main.nr         # The circuit (fn main + helper functions)
└── tests/
    ├── Nargo.toml
    └── main.nr         # Unit tests for helpers
```

## Public vs private inputs

| Input | Type | Visibility | Purpose |
|---|---|---|---|
| `commitment` | `Field` | public | Pedersen(secret, nullifier, amount) |
| `nullifier_hash` | `Field` | public | Pedersen(nullifier) — prevents double-spend |
| `publisher_pubkey_x` | `Field` | public | Binds payment to one publisher |
| `publisher_pubkey_y` | `Field` | public | (part of binding) |
| `merkle_root` | `Field` | public | Root of nullifier spent-set |
| `amount_range_bit` | `u8` | public | 0/1, says "amount is in range" |
| `secret` | `Field` | **private** | Random per-payment |
| `nullifier` | `Field` | **private** | Random per-payment, revealed only as hash |
| `amount` | `Field` | **private** | Payment amount (hidden on-chain) |
| `merkle_path` | `[Field; 20]` | **private** | Merkle proof against spent-set |
| `merkle_indices` | `[u1; 20]` | **private** | Merkle proof direction bits |

## Range proof (8 bits)

```rust
let bits: [u1; 8] = amount.to_le_bits();
let mut reconstructed: Field = 0;
for i in 0..8 {
    reconstructed = reconstructed + (bits[i] as Field) * (1 << i);
}
assert(reconstructed == amount);
```

This proves `amount ∈ [0, 255]` without revealing the actual value. Cost: 8 boolean
constraints, ~0.01% of the circuit budget.

## Pedersen commitments

Uses Noir's `std::hash::pedersen_hash([x, y, ...])` which returns a BabyJubJub curve
point embedded in the BN254 scalar field. This is the same primitive used by Aztec,
Tornado Cash, and most production privacy protocols.

Source: <https://noir-lang.org/docs/noir/standard_library/cryptographic_primitives/hashes>

## Build & test

### Prerequisites

- [`nargo` (Noir 1.0+)](https://noir-lang.org/docs/getting_started/installation)
- Optionally: [`bb` (Barretenberg)](https://github.com/AztecProtocol/aztec-packages)

### Test the circuit

```bash
cd circuits
nargo test
```

Expected output: 9 tests pass (helpers + range proof + determinism + collision).

### Compile the circuit

```bash
cd circuits
nargo compile
# Produces target/zk_paywall.json (ACIR bytecode)
```

### Generate Groth16 proof (for on-chain submission)

```bash
# Requires jamesbachini/Noir-Groth16 backend (works with nargo compile output)
# See: https://github.com/jamesbachini/Noir-Groth16

cd ../..  # back to repo root
./scripts/run_circuit.sh
# Produces target/groth16/{proof,verification_key,public_signals}.json
```

The Groth16 artifacts are what `contracts/verifier/` consumes on Stellar.

## On-chain verification

The compiled Groth16 verification key is embedded in the Soroban contract
`contracts/verifier/`. When a user submits a proof, the contract:

1. Recomputes the linear combination `vk_x = IC[0] + Σ public_input[i] * IC[i+1]`
2. Calls `env.crypto().bn254().pairing_check([(-A, B), (α, β), (vk_x, γ), (C, δ)])`
3. Returns `true` iff the proof is valid

Reference: <https://github.com/stellar/soroban-examples/tree/main/groth16_verifier>

## Why 8-bit range and not full Bulletproofs?

Bulletproofs (range proof for arbitrary bit-widths) would let us hide amounts in
`[0, 2^64]`, but they need ~2x the constraints and a longer proof generation step.

For the MVP, 8 bits (0-255 centi-cents = $0.00-$2.55) is enough to demonstrate the
primitive. Upgrading to Bulletproofs is a future PR that keeps the same commitment
scheme, so it's a backward-compatible change.

## Security notes

- This circuit has not been audited. Do not use in production with real funds.
- The `publisher binding` uses a hash-based shortcut. Real deployment should
  implement EdDSA verification inside the circuit against the publisher pubkey.
- The Merkle path length is hardcoded to 20. Adjust to match the deployed
  nullifier-set depth.

## License

MIT