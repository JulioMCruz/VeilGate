# VeilGate — Soroban Groth16 verifier

On-chain verifier for the VeilGate private paywall. Verifies Groth16 proofs over the BN254
curve using **Protocol 25 host functions** (`env.crypto().bn254()` — CAP-0074).

## What this contract does

Accepts a Groth16 proof + public inputs, computes the linear combination `vk_x`, and calls
`env.crypto().bn254().pairing_check(...)` to verify the proof. Returns `bool`.

This is the on-chain gate that says "yes, this is a valid ZK proof" without ever revealing
the payment amount.

## File layout

```
contracts/verifier/
├── Cargo.toml              # Rust package manifest
├── src/
│   ├── lib.rs              # Contract impl + verify function
│   ├── bn254.rs            # Byte decoding helpers (G1/G2/Field encoding)
│   └── test.rs             # Soroban unit tests
└── README.md
```

## Verification key (Groth16)

The verification key is **embedded in the contract at compile time** by reading the
`verification_key.json` emitted by the ACIR → Groth16 lowering step in
`scripts/run_circuit.sh`.

Structure:

```rust
pub struct VK {
    pub alpha_g1: BytesN<64>,
    pub beta_g2: BytesN<128>,
    pub gamma_g2: BytesN<128>,
    pub delta_g2: BytesN<128>,
    pub ic: Vec<BytesN<64>>,  // IC[0], IC[1], ..., IC[N_PUBLIC_INPUTS]
}
```

For the VeilGate circuit (5 public inputs), `IC.len() == 6` (IC[0] + one per public input).

## Encoding

All field/curve encodings follow the convention used by Soroban's BN254 host:

| Type | Size | Format |
|---|---|---|
| G1 point | 64 bytes | `X[32] || Y[32]`, big-endian, no flags |
| G2 point | 128 bytes | `X.c0[32] || X.c1[32] || Y.c0[32] || Y.c1[32]`, big-endian |
| Field element | 32 bytes | big-endian, unsigned |

Source: <https://github.com/stellar/soroban-examples/tree/main/groth16_verifier>

## BN254 host functions used

```rust
env.crypto().bn254().g1_add(a: G1, b: G1) -> G1       // CAP-0074, P25
env.crypto().bn254().g1_mul(a: G1, s: Scalar) -> G1   // CAP-0074, P25
env.crypto().bn254().pairing_check(                    // CAP-0074, P25
    pairs: Vec<(G1, G2)>
) -> bool
```

Reference: Stellar BN254 host functions (CAP-0074, Protocol 25).

## Build

```bash
cd contracts/verifier
cargo build --target wasm32-unknown-unknown --release
```

## Test

```bash
cd contracts/verifier
cargo test
```

## Deploy (testnet)

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/verifier.wasm \
  --source <YOUR_KEY> \
  --network testnet
```

## Verify (call from CLI / app)

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <YOUR_KEY> \
  --network testnet \
  -- verify \
  --proof_a <hex64> \
  --proof_b <hex128> \
  --proof_c <hex64> \
  --public_inputs '[<hex32>, <hex32>, ...]' \
  --vk_ic '[<hex64>, <hex64>, ...]' \
  --vk_alpha_g1 <hex64> \
  --vk_beta_g2 <hex128> \
  --vk_gamma_g2 <hex128> \
  --vk_delta_g2 <hex128>
```

Returns `bool`.

## Security

- This contract is unaudited. Do not use with real funds.
- The verification key must be regenerated whenever the Noir circuit changes.
- For production, regenerate VK from a `nargo compile` + Powers-of-Tau ceremony trusted
  by the deployer. Do not reuse the testnet VK in production.

## License

MIT