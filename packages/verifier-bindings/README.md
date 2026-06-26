# verifier-bindings

TypeScript bindings for VeilGate's standalone **Groth16 / BN254** verifier contract on
Stellar (Soroban), used over Soroban RPC.

The verifier checks the same Groth16 proofs produced by the `Withdraw(20)` circuit in
[`../../pool/`](../../pool/README.md): given a proof (`proof_a/b/c`), the verification key
(`vk_alpha_g1`, `vk_beta_g2`, `vk_gamma_g2`, `vk_delta_g2`, `vk_ic`) and the public inputs,
`verify(...)` returns a `boolean`. The contract also exposes `init(admin)`.

These bindings were generated with the Stellar/Soroban CLI:

```bash
stellar contract bindings ts \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  --contract-id CAW4VAGEOBMQIOVFJD354BXN5O3LRP3GZGMCDEPZDNQKDUN7TZYAR45V \
  --output-dir ./packages/verifier-bindings
```

The network passphrase and contract ID are exported from
[`src/index.ts`](./src/index.ts) in the `networks` constant (currently `testnet`).

## Use it

Add it to your `package.json` via a file path:

```json
"dependencies": {
  "verifier-bindings": "./packages/verifier-bindings"
}
```

Then import the client and call the contract:

```ts
import { Client, networks } from "verifier-bindings";

const verifier = new Client({
  ...networks.testnet,
  rpcUrl: "https://soroban-testnet.stellar.org",
});

// verify(...) returns an AssembledTransaction<boolean>
const { result } = await (
  await verifier.verify({
    _proof_a, _proof_b, _proof_c,
    _vk_alpha_g1, _vk_beta_g2, _vk_gamma_g2, _vk_delta_g2, _vk_ic,
    _public_inputs,
  })
).simulate();
```

Each contract method is exported as an async function with inline documentation generated
from the contract source.
