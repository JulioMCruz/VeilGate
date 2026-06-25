# VeilGate — Soroban Contract Scaffold

Generated via `stellar_soroban_scaffold_contract` from Stellar-mcp.
Reference: https://github.com/JulioMCruz/Stellar-mcp/docs/AGENT_SOROBAN_CODING_GUIDE.md

## File Layout (Stellar-mcp scaffold)

```
contracts/
├── Cargo.toml              # Workspace root
├── Cargo.lock
└── verifier/
    ├── Cargo.toml
    ├── src/
    │   └── lib.rs          # #![no_std] contract
    └── tests/
        └── test.rs
```

## Build Commands

```bash
# Install wasm32 target (required)
rustup target add wasm32v1-none

# Build contract
cd contracts/verifier
cargo build --target wasm32v1-none --release

# Or use Stellar CLI
stellar contract build

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32v1-none/release/veilgate_verifier.wasm \
  --source <KEY_NAME> \
  --network testnet

# Generate TypeScript bindings
stellar contract bindings typescript \
  --contract-id <CONTRACT_ID> \
  --output-dir ./packages/verifier-bindings \
  --overwrite
```

## Contract Rules (from AGENT_SOROBAN_CODING_GUIDE.md)

- Use `#![no_std]`
- Keep public methods small and explicit
- Prefer exact integer types (u32, i128, etc.)
- Use clear storage keys
- Do not store secrets on-chain
- Verify CONTRACT_ID before calling
- Use Testnet first

## Testing

```bash
cd contracts/verifier
cargo test
```

## Reference

- Soroban setup: https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup
- Hello World: https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world
- Deploy: https://developers.stellar.org/docs/build/smart-contracts/getting-started/deploy-to-testnet
- Stellar CLI: https://developers.stellar.org/docs/tools/cli/stellar-cli
- TypeScript bindings: https://developers.stellar.org/docs/build/apps/guestbook/bindings

## License

MIT