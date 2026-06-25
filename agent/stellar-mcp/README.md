# VeilGate — Stellar MCP Integration

This directory contains the Stellar MCP (Model Context Protocol) integration
for VeilGate. It uses [JulioMCruz/Stellar-mcp](https://github.com/JulioMCruz/Stellar-mcp)
as the canonical MCP server for all Stellar interactions.

## Why Stellar-mcp?

Instead of maintaining custom Python wrappers for Soroban RPC, we use the
official Stellar MCP server which provides:

- `stellar_soroban_simulate` — Simulate contract calls
- `stellar_soroban_invoke` — Invoke + sign + submit transactions
- `stellar_soroban_get_events` — Query contract events
- `stellar_soroban_read_state` — Read contract state directly
- `stellar_get_account` — Account balances + info
- `stellar_submit_payment` — Direct payments
- `stellar_xdr_encode` / `stellar_decode_xdr` — XDR utilities
- And 30+ more tools (see [docs/TOOLS.md](https://github.com/JulioMCruz/Stellar-mcp/blob/main/docs/TOOLS.md))

## Setup

```bash
cd agent/stellar-mcp
npm install
```

## Configuration

Copy `.env.example` to `.env` and fill in:

```bash
# Network
STELLAR_NETWORK=testnet

# Contract IDs (from deployment)
STELLAR_CONTRACT_ID=C...        # VeilGate verifier contract

# RPC endpoints (optional — defaults to SDF testnet)
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_RPC_URL=https://soroban-testnet.stellar.org

# Signing policy (safe = unsigned XDR only)
STELLAR_AUTO_SIGN_POLICY=safe

# Optional: for testnet friendbot funding
STELLAR_SECRET_KEY=SD...          # ONLY for testnet demos
```

## Usage

### Stdio mode (default, for Claude Desktop / Cursor)

```bash
npm run mcp:start
```

### HTTP/SSE mode (for remote agents)

```bash
npm run mcp:http
# Check health
curl http://localhost:3403/health
```

### With Hermes Agent

In your `hermes config`, add Stellar-mcp as a server:

```yaml
mcp_servers:
  stellar:
    type: stdio
    command: node
    args: ["/ABSOLUTE/PATH/TO/VeilGate/agent/stellar-mcp/node_modules/@juliomcruz/stellarmcp/build/src/index.js"]
    env:
      STELLAR_NETWORK: "testnet"
      STELLAR_CONTRACT_ID: "C..."
```

Then in your VeilGate skill, call Stellar-mcp tools directly:

```
# Simulate a verify() call
stellar_soroban_simulate {
  "contractId": "C...",
  "function": "verify",
  "args": [...]
}

# Read verifier state
stellar_soroban_read_state {
  "contractId": "C...",
  "key": { "symbol": "admin" }
}

# Get account info (for wallet status)
stellar_get_account {
  "accountId": "G..."
}
```

## VeilGate-specific flow

```
1. User: /veilgate pay https://example.com/article
2. Hermes calls veilgate_generate_proof (local skill)
3. Hermes calls stellar_soroban_invoke to submit verify() tx
4. Hermes calls stellar_soroban_get_events to confirm
5. Hermes returns content + receipt
```

## Reference

- Stellar-mcp repo: https://github.com/JulioMCruz/Stellar-mcp
- Stellar-mcp docs: https://github.com/JulioMCruz/Stellar-mcp/blob/main/docs/TOOLS.md
- Stellar-mcp guide: https://github.com/JulioMCruz/Stellar-mcp/blob/main/docs/AGENT_SOROBAN_CODING_GUIDE.md
- MCP protocol: https://modelcontextprotocol.io

## License

MIT