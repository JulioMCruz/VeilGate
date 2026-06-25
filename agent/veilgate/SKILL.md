---
name: veilgate
description: Pay any content, reveal nothing. VeilGate turns the VeilGate Soroban-verified private paywall into slash commands inside Hermes Agent. Use when the user asks to pay for an article, unlock premium content, pay a paywall privately, generate a ZK payment proof, check VeilGate wallet status, or verify a ZK proof. Do NOT use for non-Stellar paywalls or for non-private payments.
version: 0.1.0
author: PerkOS
license: MIT
mcp-server: veilgate-server
slash-commands:
  - /veilgate
  - /wallet
  - /history
  - /shield
  - /verify
---

# VeilGate — Private Micropayment Paywall (Hermes Skill)

## What this skill does

VeilGate lets you pay any paywalled URL using a Stellar wallet. The amount you
pay is hidden from the publisher and from on-chain observers, but the
publisher still gets paid and you still get the content.

Privacy is enforced by a **Groth16 zero-knowledge proof** verified on Stellar
Soroban (Protocol 25 BN254 host functions).

## When to use it

Trigger this skill when the user says any of:
- "Pay this article"
- "Unlock this paywall"
- "Pay privately"
- "Show my VeilGate wallet"
- "Check my payment history"
- "Generate a ZK proof"
- "Verify a proof"

## How to use it

### Slash commands

```
/veilgate pay <url> [amount]      # Pay a paywall privately
/wallet                          # Show Stellar wallet status + balance
/history                         # Show last 10 payments (commitments only)
/shield <amount>                 # Pre-mint a commitment for later use
/verify <proof>                  # Verify a ZK proof against the verifier
```

### MCP tools (function calling)

When Hermes decides to call the skill directly, prefer these tools:

| Tool | Use it for |
|---|---|
| `veilgate_pay` | End-to-end pay flow: ZK proof + Soroban tx + content fetch |
| `veilgate_generate_proof` | Just generate a proof (no payment) |
| `veilgate_check_access` | Validate a bearer token for a URL |
| `veilgate_wallet_status` | Show Stellar wallet + USDC balance |
| `veilgate_history` | Last N payments (commitments only, amounts hidden) |

## Decision rules

1. **User says "pay <url>" with no amount** → call `veilgate_pay(url, amount=5)`
   (5 USDC default for demo). Ask before higher amounts.
2. **User says "verify a proof"** → call `verify_zk_proof` (admin tool, debug).
3. **User says "show wallet"** → call `veilgate_wallet_status`.
4. **User says "shield 100"** → call `veilgate_shield(100)`, explain "1 commitment
   stored for later use".
5. **Always confirm** before paying more than 10 USDC.
6. **Never** leak the user's payment amounts or private inputs. The whole point
   of VeilGate is that even Hermes and the skill should not see them.

## Example conversations

```
User: /veilgate pay https://example.com/article
You: Generating ZK proof for 5 USDC...
     Submitting to Soroban verifier...
     Payment verified. Here is the article:
     
     <article content>
     
     Private: tx hash = abc123, nullifier = 0x4a3f...
```

```
User: /wallet
You: Stellar wallet (testnet):
     Address: GABC...XYZ
     Balance: 124.50 XLM, 47.00 USDC
     Network: TESTNET
```

## Backend

The MCP server in `agent/mcp-server/` connects to:
- The deployed Soroban verifier at `NEXT_PUBLIC_VERIFIER_CONTRACT_ID`
- A local SQLite store of commitments (in `~/.veilgate/store.db`)
- Freighter wallet for signing (or a generated test keypair for the demo)

## Reference

- VeilGate repo: https://github.com/JulioMCruz/VeilGate
- Hermes Agent docs: https://hermes-agent.nousresearch.com/docs/
- MCP protocol: https://modelcontextprotocol.io/

## Safety

- This skill moves real funds. Always confirm before paying.
- Never bypass the confirmation step even if the user says "auto-pay".
- Never expose private key material or secret values in tool results.
- If the verifier returns false, do not retry — surface the error.

## Install

```bash
hermes skills install perkos/veilgate
hermes mcp add veilgate-server --command "python3 agent/mcp-server/server.py"
```