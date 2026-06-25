# VeilGate — Hermes agent integration

This directory is the **Hermes** agent integration for VeilGate: it exposes the
shielded paywall as slash commands and MCP tools so any Hermes-enabled chat
surface (CLI, Telegram, Discord, Slack, WhatsApp) can drive a VeilGate payment
from a conversation.

> **What "private" means here.** VeilGate is a fixed-denomination shielded pool.
> The privacy it provides is **unlinkability + identity hiding**: an observer
> can't tell which deposit funded which payment, and the publisher never learns
> the payer's wallet. The **denomination is public** (it's the pool's fixed
> amount). This integration does **not** hide the amount — don't describe it
> that way.

> **Status — earlier scaffold, not the judged flow.** The MCP server here is an
> exploration scaffold built around the earlier Noir-style circuit (a
> placeholder Pedersen/SHA-256 commitment over `secret · nullifier · amount`,
> see `mcp-server/proof.py`). The live, judged settlement is the **Circom +
> Groth16 shielded pool** in `../pool/` + `../contracts/pool/`, settling in
> **native XLM** on testnet. Treat this folder as the chat-UX layer / reference,
> and read the repo root `../README.md` for the real flow.

## File layout

```
agent/
├── veilgate/
│   └── SKILL.md                  # Skill instructions for Hermes
├── mcp-server/
│   ├── server.py                 # MCP server (Anthropic MCP SDK + stdio transport)
│   ├── proof.py                  # ZK proof scaffold (Pedersen + placeholder Groth16)
│   ├── soroban.py                # Verifier tx build + submit
│   ├── wallet.py                 # Freighter / keypair wrappers
│   ├── store.py                  # SQLite store of commitments + history
│   └── requirements.txt
├── stellar-mcp/                  # Stellar MCP server wiring (Soroban RPC tools)
├── x402/                         # x402 USDC payment scaffold — DEMO ONLY (see below)
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
| `veilgate_wallet_status` | Show Stellar wallet + balance |
| `veilgate_history` | Last N payments (commitments only) |
| `veilgate_shield` | Pre-mint a commitment |
| `verify_zk_proof` | Verify a ZK proof (debug) |

The history/store keeps **commitments only** — it doesn't link a commitment back
to the payer, which is what makes the deposit↔payment relationship unlinkable.

## A note on `agent/x402/` (USDC — demo scaffold, not the real flow)

`agent/x402/` is a **payment-scaffold only**. It wires up the x402 "HTTP 402 →
sign → settle" pattern using **USDC** through the PerkOS Stellar relayer, and it
exists purely to demonstrate agentic-commerce plumbing. **It is not the VeilGate
settlement path and not the judged flow.** The same applies to the
`app/api/content` x402 demo route.

The real VeilGate settlement does **not** use USDC or x402: it moves **native
XLM** through the **shielded pool** (`../contracts/pool/`), gated by an inline
Groth16/BN254 proof verification. If you want the privacy guarantees, use the
pool — x402/USDC here is convenience scaffolding around it.

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
- Live app: https://veilgate.vercel.app

## License

MIT
