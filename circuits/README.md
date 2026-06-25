# circuits/ — Noir circuit (earlier exploration, NOT the live path)

> **Status: earlier exploration — not the live settlement path.**
> This is a Noir + Barretenberg **UltraHonk** circuit from an early design pass. On-chain
> UltraHonk verification **exceeds the Stellar testnet per-transaction budget** — it runs
> only on a localnet with raised resource limits. The **live product settles through the
> Groth16 path in [`../pool/`](../pool/README.md)** (Circom + snarkjs, a `Withdraw(20)`
> circuit verified on testnet). Keep that in mind while reading; this directory is kept for
> reference and history, not for the deployed flow.

## What it proves

VeilGate's privacy property is **unlinkability** (a payout cannot be linked back to the
deposit that funded it) plus identity hiding. The note **amount/denomination is public** —
this circuit does **not** keep the amount secret. The range check below only proves the
amount sits within a fixed bucket; it does not hide the value.

Given private inputs `(secret, nullifier, amount, merkle_path, merkle_indices)` and public
inputs `(commitment, nullifier_hash, publisher_pubkey_(x,y), merkle_root, amount_range_bit)`,
the circuit enforces (every check is a real constraint — none are decorative):

1. **Commitment is well-formed**: `commitment == Pedersen(secret, nullifier, amount)`
2. **Publisher-bound nullifier**: `nullifier_hash == Pedersen(nullifier, pub_x, pub_y)`.
   Folding the publisher pubkey into the nullifier hash binds the spend to one publisher,
   so a proof cannot be replayed to a different publisher, and the spent-set is scoped per
   publisher.
3. **Amount fits in 8 bits**: `amount ∈ [0, 255]` (a public-bucket range proof — it proves
   the amount is in range, it does not conceal it)
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
| `amount` | `Field` | private witness | The amount; supplied as a witness for the range/commitment checks (the value itself is **not** kept secret by VeilGate — the denomination is public) |
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
amount), and the explicit reconstruction is a documented defense-in-depth check. This
proves the amount is in range; it is not an amount-hiding mechanism.

## Pedersen commitments

Uses Noir's `std::hash::pedersen_hash([x, y, ...])`, a BabyJubJub-based hash over the
BN254 scalar field.

Source: <https://noir-lang.org/docs/noir/standard_library/cryptographic_primitives/hashes>

## Build & test

### Prerequisites
- [`nargo` (Noir 1.0+)](https://noir-lang.org/docs/getting_started/installation) — tested with `1.0.0-beta.9`
- Optionally: [`bb` (Barretenberg)](https://github.com/AztecProtocol/aztec-packages) for UltraHonk proving

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
nargo compile          # → target/*.json (ACIR bytecode)
nargo info             # opcode/gate counts for main
```

## Why this is not the live path

Noir proves with **UltraHonk** (Barretenberg), not Groth16. Verifying an UltraHonk proof
on-chain costs more than a single Stellar testnet transaction's resource budget allows, so
it is viable only on a localnet with raised limits. Rather than depend on that — or on a
fragile ACIR → Groth16 lowering of this circuit — VeilGate ships the **Circom + Groth16**
`Withdraw(20)` circuit in [`../pool/`](../pool/README.md), which verifies within the testnet
budget via the native BN254 host functions. This Noir circuit remains an earlier exploration
kept for reference.

## Security notes

- This circuit has not been audited and is not on the live path. Do not use with real funds.
- The **publisher binding** is enforced (publisher pubkey folded into the nullifier hash).
  A stronger variant would EdDSA-verify a publisher signature inside the circuit.
- The Merkle proof is **commitment membership** (allow-list), depth hardcoded to 20.
- The 8-bit amount range is an MVP bucket choice; the amount is public regardless.

## License

MIT
