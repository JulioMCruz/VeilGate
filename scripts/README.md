# VeilGate — proving-harness scripts (earlier Noir / UltraHonk exploration)

> **Heads-up — this is the earlier exploration path, not the live settlement.**
> These scripts drive the **Noir circuit** in `../circuits/` and Aztec's
> **Barretenberg (UltraHonk)** prover. UltraHonk verification runs in-wasm and
> **exceeds the Stellar testnet per-tx budget**, so the live VeilGate pool does
> **not** use it. The shipped product settles through the **Circom + Groth16**
> circuit under `../pool/` (verified on-chain via the native BN254 host
> functions). Keep these scripts for reference / localnet experiments only.

This folder is a small standalone harness (its own `package.json`) for
generating and self-verifying an UltraHonk proof from the Noir paywall circuit.

## Files

### `prove_ultrahonk.mjs`
The Noir-native proving path — the same one the browser would use via
`@aztec/bb.js`. It:

1. Loads the compiled circuit (`../circuits/target/zk_paywall.json`).
2. Executes it with a canonical valid witness (mirrors `circuits/Prover.toml`
   and the circuit test `test_valid_payment_proof_succeeds`).
3. Generates a **real UltraHonk proof** with `UltraHonkBackend` (bb.js) and
   verifies it.
4. Runs a tamper check: corrupts a public input and asserts the proof is
   rejected.
5. Writes `out/proof.bin` + `out/public_inputs.json` and prints `PASS` only if
   the valid proof verifies **and** the tampered one is rejected.

```bash
npm install              # @aztec/bb.js + @noir-lang/noir_js
npm run prove            # == node prove_ultrahonk.mjs
```

Prereq: `cd ../circuits && nargo compile` first (produces `zk_paywall.json`).

### `build_proof_artifacts.sh`
Regenerates the UltraHonk artifacts intended for an **on-chain UltraHonk
verifier** (the separate, heavier component documented in
`../contracts/ULTRAHONK_ONCHAIN.md`). It runs `nargo compile` + `nargo execute`
to get the witness, then uses the `bb` CLI with the exact flags the Soroban
UltraHonk verifier expects (`--scheme ultra_honk --oracle_hash keccak
--output_format bytes_and_fields`):

- `bb prove`  → `circuits/target/proof` (+ `public_inputs`)
- `bb write_vk` → `circuits/target/vk`

It then copies `vk` / `proof` / `public_inputs` into `circuits/artifacts/`.

```bash
./build_proof_artifacts.sh
```

Pinned toolchain (must match): `nargo 1.0.0-beta.9`, `bb v0.87.0`
(barretenberg release). `bb` is expected at `$BB` (defaults to `~/.bb/bb`).

### `run_circuit.sh`
A documented **Noir → Groth16** pipeline sketch: `nargo compile` →
`nargo execute` (witness) → Groth16 setup (downloads the Hermez powers-of-tau) →
prove → encode for Soroban. It depends on an external ACIR→Groth16 lowering
backend (`$NOIR_GROTH16_BIN`) and an `encode_bn254_for_soroban.mjs` encoder that
are not bundled here, so most stages print guidance and skip if their inputs are
missing. Treat this as an illustration of the Noir-side Groth16 flow — the
**actual** Groth16 path that ships is Circom-based, under `../pool/`.

### `package.json`
Declares the harness (`type: module`) and its two deps —
`@aztec/bb.js` and `@noir-lang/noir_js` — plus the `prove` script.

## Output

`out/` holds the last `prove_ultrahonk.mjs` run (`proof.bin`,
`public_inputs.json`). It is throwaway and not the on-chain settlement proof.

## Where the live path lives

- Settlement circuit + proving: `../pool/` (Circom + snarkjs, Groth16)
- Shielded pool contract (on-chain tree, native Poseidon, inline BN254 verify):
  `../contracts/pool/`
- Earlier Noir/UltraHonk notes + findings: `../contracts/ULTRAHONK_ONCHAIN.md`

Live app: <https://veilgate.vercel.app>
