# pool/ — Private settlement layer (the live path)

This is the layer that makes the payment **actually happen** on-chain, and it is the
circuit VeilGate's deployed pool verifies. It is a **Circom + Groth16** `Withdraw(20)`
circuit proving Merkle membership + nullifier + recipient binding, settled on **Stellar
testnet** in native **XLM**.

## What VeilGate hides (and what it does not)

VeilGate's privacy property is **unlinkability**: an on-chain observer cannot link a
payout back to the deposit that funded it, nor to the payer's identity. The note
**denomination is public** — it is a fixed bucket chosen on-chain, not a secret. We do
**not** hide the amount; we hide the *link* between deposit and payout.

## Model: fixed-denomination shielded pool

Real **XLM** moves on testnet; the **link** between a payment and the depositor/identity
is hidden (unlinkable). The per-note amount is a **public fixed denomination** (a few
buckets give coarse anonymity-set grouping by amount).

- **Denominations:** fixed buckets, each a separate pool instance sharing the same circuit
  and verification key (the denomination lives in the contract, not in the proof).
- **Token:** native **XLM** on Stellar testnet, moved via its Stellar Asset Contract (SAC).
- **On-chain verification:** **Groth16 over BN254**, via the native Soroban host functions
  (`bn254` G1/G2 ops + `pairing_check`). This is the ZK path that fits the **testnet
  per-transaction budget**.
- **Proof toolchain:** **Circom + snarkjs** producing a native Groth16 proof.

## Flow

```
deposit(denom, commitment):
  payer transfers DENOM of XLM into the pool (via the SAC)
  pool inserts `commitment` into its Merkle tree, emits an event

withdraw(proof, root, nullifierHash, recipient):     // this is the "pay"
  pool verifies the Groth16 proof:
    - commitment = Poseidon(nullifier, secret) is a member of `root`
    - nullifierHash = Poseidon(nullifier)
    - `recipient` (the publisher) is bound into the proof (anti-malleability)
  require nullifierHash not spent  ->  mark spent
  pool transfers DENOM of XLM to `recipient`
```

**Hidden:** which deposit funded the payment, and who paid (unlinkability + identity).
**Public:** the denomination.

## Circuit — `circuits/withdraw.circom`

`Withdraw(20)` is a Poseidon-based withdraw circuit over a depth-20 Merkle tree.

- **Public inputs:** `root`, `nullifierHash`, `recipient`
- **Private inputs:** `nullifier`, `secret`, `pathElements[20]`, `pathIndices[20]`
- **Constraints enforced:**
  - `nullifierHash == Poseidon(nullifier)` — the revealed double-spend tag.
  - Merkle membership of `commitment = Poseidon(nullifier, secret)` against `root`
    (recomputed level by level with a branch-free left/right mux).
  - `recipient` is folded in (squared) so a relayer/observer cannot re-target the payout.

One circuit and one verification key serve every denomination; the denomination is held by
the contract, never in the proof.

## Build the artifacts

```bash
cd pool
npm install                # circomlib + snarkjs + circomlibjs
npm run build:circuit      # scripts/build.sh
```

`npm run build:circuit` compiles the circuit and runs a Groth16 (BN128/BN254) trusted
setup, producing in `pool/build/`:

- `withdraw.r1cs`, `withdraw_js/withdraw.wasm` — compiled circuit + witness generator
- `withdraw_final.zkey` — proving key
- `verification_key.json` — verification key (consumed by the on-chain verifier)

## Generate a note + proof

```bash
PUBLISHER=G... node scripts/pool_demo.mjs
```

`scripts/pool_demo.mjs` generates one note (`nullifier`, `secret`), builds the commitment
tree, derives the public `recipient` field from the publisher strkey
(`sha256(strkey)` with the top byte zeroed so it stays below the BN254 field order, matching
the contract's `recipient_field_of(Address)`), produces a Groth16 proof with snarkjs, and
encodes the proof + verification key + public inputs into the byte/JSON format the pool
contract consumes. It writes `/tmp/pool_demo.env` (`PROOF_A/B/C`, `VK_*`, `VK_IC`,
`COMMITMENT`, `ROOT`, `NULLIFIER_HASH`, `RECIPIENT_FIELD`). Set `NULLIFIER`/`SECRET` to
produce deterministic fixtures.

## Test

```bash
npm test                   # scripts/pathfor_test.mjs
```

`scripts/pathfor_test.mjs` is the integration test for the app's off-chain tree
reconstruction (`app/lib/pool.ts` `pathFor`). It rebuilds the commitment tree for several
leaf positions (single leaf, a right child, a deeper index), generates a real `Withdraw(20)`
proof for each, and asserts snarkjs verifies them — confirming the browser path
reconstruction yields circuit-valid proofs at any index. Exit code 0 means pass.

## On-chain verification

A standalone Groth16/BN254 verifier contract checks these proofs on testnet (valid proof →
`true`, tampered public input → `false`), confirming the snarkjs → Soroban encoding bridge
(including EIP-197 G2 `c1`-first ordering). The pool contract reuses this verification path.
See `packages/verifier-bindings/` for the TypeScript client of the standalone verifier.

## Status

- [x] Circuit (`circuits/withdraw.circom`) — `Withdraw(20)`, Poseidon
- [x] Groth16 setup + artifacts (snarkjs)
- [x] `pathfor_test.mjs` — app tree reconstruction yields circuit-valid proofs
- [x] Proof verified by the BN254 Soroban verifier on **testnet** (valid → true, tampered → false)
- [ ] Pool contract (deposit / withdraw + SAC transfers + nullifier set)
- [ ] Deployed to testnet; real deposit + withdraw moving XLM
- [ ] Wired into the app
