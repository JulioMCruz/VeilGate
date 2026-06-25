# On-chain UltraHonk verification of the VeilGate circuit

This documents the **Noir-native** verification path: the VeilGate Noir circuit is
proven with Barretenberg (UltraHonk) and the proof is verified **on-chain** by a
Soroban UltraHonk verifier contract.

This is the path the Stellar ZK docs reference for Noir (vs. the Groth16 verifier in
`contracts/verifier/`, which would require an ACIR→Groth16 lowering of this circuit).

## Status — DONE (on localnet)

| Step | Result |
|---|---|
| Generate proof + VK from `circuits/` with `bb` (ultra_honk, keccak) | ✅ proof 14592 B, vk 1760 B, public_inputs 192 B (6×32) |
| Verify our proof against the verifier in the SDK env (unit test) | ✅ valid → ok, tampered public input → err |
| Deploy verifier + invoke `verify_proof` on-chain | ✅ **localnet** |

**On-chain results (localnet, `--limits unlimited`):**
- `verify_proof(public_inputs, proof)` → `Ok` (returns `null`) — **proof verified on-chain**.
- One byte of `public_inputs` flipped → `Error(Contract, #3)` = `VerificationFailed` — **rejected**.

Localnet contract id (ephemeral): `CAXSL65UHQU7JB4U4BCVLXFM46B5RRM32IZU7WEH4SHXOUASIU7FT5CG`

## Important finding — testnet budget

UltraHonk verification runs **in-wasm** (a pure-Rust verifier), not via native host
functions, so it is compute-heavy. On **testnet** the call fails at simulation:

```
HostError: Error(Budget, ExceededLimit)
```

It therefore needs a network with **raised limits**
(`stellar container start -t future --name local --limits unlimited`). Options to make it
fit a public network: Protocol 26 (cheaper ZK verification) and/or a smaller circuit.

> Contrast: `contracts/verifier/` (Groth16) uses the **native** BN254 host functions
> (`pairing_check`) and verifies fine on **testnet**
> (`CAW4VAGEOBMQIOVFJD354BXN5O3LRP3GZGMCDEPZDNQKDUN7TZYAR45V`) — but with a generic BN254
> proof, not this Noir proof.

## The verifier contract

The on-chain verification uses a generic, circuit-agnostic **UltraHonk Soroban verifier**
(an external MIT component — VK fixed at deploy). Interface:

- `__constructor(vk_bytes: Bytes)` — store the VK at deploy time
- `verify_proof(public_inputs: Bytes, proof_bytes: Bytes) -> Result<(), Error>`

It builds with our toolchain (`stellar contract build`) and is **not** vendored into this
repo. Our own contribution here is the circuit, the proof/VK artifacts, and the
build/deploy/verify recipe below.

## Reproduce

### 1. Artifacts (committed under `circuits/artifacts/`)
Regenerate with the pinned toolchain (`nargo 1.0.0-beta.9`, `bb v0.87.0`):
```bash
./scripts/build_proof_artifacts.sh
```
This runs `nargo execute`, then:
```bash
bb prove   -b target/zk_paywall.json -w target/zk_paywall.gz -o target \
           --scheme ultra_honk --oracle_hash keccak --output_format bytes_and_fields
bb write_vk -b target/zk_paywall.json -o target \
           --scheme ultra_honk --oracle_hash keccak --output_format bytes_and_fields
```

> `bb v0.87.0` installs from the aztec-packages release tag `v0.87.0`
> (asset `barretenberg-<arch>-<os>.tar.gz`).

### 2. Localnet + deploy + verify
```bash
# raised limits (UltraHonk exceeds the default per-tx budget)
stellar container start -t future --name local --limits unlimited
stellar network add localnet --rpc-url http://localhost:8000/rpc \
  --network-passphrase "Standalone Network ; February 2017"
stellar keys generate vg-local --network localnet --fund

VK=$(xxd -p circuits/artifacts/vk | tr -d '\n')
PUB=$(xxd -p circuits/artifacts/public_inputs | tr -d '\n')
PROOF=$(xxd -p circuits/artifacts/proof | tr -d '\n')

CID=$(stellar contract deploy \
  --wasm <ultrahonk_verifier>.wasm \
  --source vg-local --network localnet -- --vk_bytes "$VK")

# Ok (verified):
stellar contract invoke --id $CID --source vg-local --network localnet -- \
  verify_proof --public_inputs "$PUB" --proof_bytes "$PROOF"
```
