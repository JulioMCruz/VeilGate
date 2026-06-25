# pool/ — Private settlement layer (real USDC payment on testnet)

This is the layer that makes the payment **actually happen** on-chain. The circuit +
verifier in `circuits/` and `contracts/verifier/` prove a private amount; this layer
escrows and moves real value.

## Model (approved): multi-denomination shielded pool

A Tornado / Privacy-Pools style design. Real tokens move on testnet; the **link** between
a payment and the depositor/identity is hidden (unlinkable). The per-note amount is a
**public fixed denomination** (we run a few buckets for coarse amount privacy).

- **Denominations:** `0.1 / 1 / 10` (each a separate pool instance, same circuit + VK).
- **Token:** a test asset we issue + its Soroban Asset Contract (SAC) — reliable for the
  demo; the testnet USDC SAC can be swapped in.
- **On-chain verification:** **Groth16 over BN254**, via the native host functions
  (`g1_mul`, `g1_add`, `pairing_check`). This is the only ZK path that fits the **testnet
  per-tx budget** (UltraHonk runs in-wasm and exceeds it). We reuse the verifier pattern
  already deployed at `CAW4VAGEOBMQIOVFJD354BXN5O3LRP3GZGMCDEPZDNQKDUN7TZYAR45V`.
- **Proof toolchain:** **Circom + snarkjs** → native Groth16 (the stack the reference
  Privacy-Pools PoC uses).

## Flow

```
deposit(denom, commitment):
  reader transfers DENOM of the token into the pool (via SAC)
  pool inserts `commitment` into its Merkle tree, emits an event

withdraw(proof, root, nullifierHash, publisher):     // this is the "pay"
  pool verifies the Groth16 proof:
    - commitment = Poseidon(nullifier, secret) is a member of `root`
    - nullifierHash = Poseidon(nullifier)
    - `publisher` is bound into the proof (anti-malleability)
  require nullifierHash not spent  ->  mark spent
  pool transfers DENOM of the token to `publisher`
```

**Private:** which deposit funded the payment, and who paid. **Public:** the denomination.

## Circuit (`circuits/withdraw.circom`)

Tornado-style withdraw over Poseidon:
- private: `nullifier`, `secret`, `pathElements[20]`, `pathIndices[20]`
- public: `root`, `nullifierHash`, `recipient` (the publisher)
- enforces: `Poseidon(nullifier)==nullifierHash`, Merkle membership of
  `Poseidon(nullifier, secret)` against `root`, and squares `recipient` to bind it.

One circuit/VK serves all denominations (denom lives in the contract, not the proof).

## Build

```bash
cd pool && npm install        # circomlib
npm run build:circuit         # compile + groth16 setup + export vk  (scripts/)
npm run prove                 # generate + verify a sample proof
```

## On-chain verification — validated on testnet

`scripts/encode_for_soroban.mjs` generates a withdraw proof and encodes it (+ the VK)
to the BN254 verifier's byte format, then we invoke the **already-deployed** verifier
(`CAW4VAGEOBMQIOVFJD354BXN5O3LRP3GZGMCDEPZDNQKDUN7TZYAR45V`) on testnet:

```
verify(...) with a valid Circom/snarkjs proof   -> true   (within testnet budget)
verify(...) with a tampered public input        -> false
```

This confirms the encoding bridge (incl. EIP-197 G2 `c1`-first ordering) and that the
Groth16-on-testnet path works. The pool contract reuses this verification.

## Status

- [x] Circuit (`circuits/withdraw.circom`)
- [x] Groth16 setup + sample proof (snarkjs)
- [x] Proof verified by the BN254 Soroban verifier on **testnet** (valid → true, tampered → false)
- [ ] Pool contract (deposit / withdraw + SAC transfers + nullifier set)
- [ ] Deployed to testnet; real deposit + withdraw moving tokens
- [ ] Wired into the app
