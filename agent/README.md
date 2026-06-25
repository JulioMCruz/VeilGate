# VeilGate — Hermes Agent plugin

This directory contains the Hermes Agent integration for VeilGate. It exposes
the private paywall as slash commands and MCP tools so that any Hermes-enabled
chat surface (CLI, Telegram, Discord, Slack, WhatsApp) can pay content
privately.

## File layout

```
agent/
├── veilgate/
│   └── SKILL.md                  # Skill instructions for Hermes
├── mcp-server/
│   ├── server.py                 # MCP server (Anthropic SDK + stdio transport)
│   ├── proof.py                  # ZK proof generation (Pedersen + placeholder Groth16)
│   ├── soroban.py                # Verifier tx build + submit
│   ├── wallet.py                 # Freighter / keypair wrappers
│   ├── store.py                  # SQLite store of commitments + history
│   └── requirements.txt
└── demo/
    └── agent-buyer.py            # End-to-end demo agent (Telegram)
```

## Slash commands

```
/veilgate pay <url> [amount]
/wallet
/history
/shield <amount>
/verify <proof>
```

## MCP tools

| Tool | Description |
|---|---|
| `veilgate_pay` | Pay a paywall end-to-end (ZK proof + Soroban tx + fetch) |
| `veilgate_generate_proof` | Generate a ZK proof without paying |
| `veilgate_check_access` | Validate a bearer token for a URL |
| `veilgate_wallet_status` | Show Stellar wallet + USDC balance |
| `veilgate_history` | Last N payments (commitments only) |
| `veilgate_shield` | Pre-mint a commitment |
| `verify_zk_proof` | Verify a ZK proof (debug) |

## Install

```bash
# 1. Install skill
hermes skills install perkos/veilgate

# 2. Install MCP server
pip install -r agent/mcp-server/requirements.txt
hermes mcp add veilgate-server --command "python3 agent/mcp-server/server.py"

# 3. Set env
export VEILGATE_VERIFIER_CONTRACT_ID=C...
export VEILGATE_NETWORK=testnet
export VEILGATE_WALLET_SECRET=SD...     # or use Freighter via CLI

# 4. Test
hermes slash /veilgate wallet
```

## Reference

- Hermes Agent: https://hermes-agent.nousresearch.com/docs/
- MCP protocol: https://modelcontextprotocol.io/
- Anthropic MCP SDK: https://github.com/modelcontextprotocol/python-sdk
- Stellar SDK: https://github.com/StellarCN/py-stellar-base
- VeilGate repo: https://github.com/JulioMCruz/VeilGate

## License

MIT