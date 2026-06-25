---
name: veilgate
description: Pay any content, reveal nothing. VeilGate turns the Soroban-verified private paywall into slash commands inside Hermes Agent. Uses Stellar-mcp (JulioMCruz/Stellar-mcp) as the canonical MCP server for all Stellar interactions. Use when the user asks to pay for an article, unlock premium content, pay a paywall privately, generate a ZK payment proof, check VeilGate wallet status, or verify a ZK proof. Do NOT use for non-Stellar paywalls or non-private payments.
version: 0.1.0
author: PerkOS
license: MIT
mcp-server: stellar-mcp
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

### MCP tools — Stellar-mcp integration

This skill uses **JulioMCruz/Stellar-mcp** as the canonical MCP server for
all Stellar interactions. Install it alongside this skill.

**Stellar-mcp tools used by VeilGate:**

| Tool | Purpose | When called |
|---|---|---|
| `stellar_soroban_simulate` | Simulate verifier.verify() before submitting | Before any contract call |
| `stellar_soroban_invoke` | Invoke verifier.verify() on-chain | For the actual ZK verification |
| `stellar_soroban_get_events` | Query contract events for payment confirmation | After tx submission |
| `stellar_soroban_read_state` | Read spent-set to prevent double-spend | Before payment |
| `stellar_get_account` | Show wallet balances | For /wallet command |
| `stellar_submit_payment` | Direct USDC/XLM transfer (fallback) | Non-ZK payments |

**VeilGate-specific tools** (local to this skill):

| Tool | Purpose |
|---|---|
| `veilgate_generate_proof` | Generate Pedersen commitment + nullifier + placeholder Groth16 |
| `veilgate_check_access` | Validate bearer token for content URL |
| `veilgate_history` | Last N payments from local store |
| `veilgate_shield` | Pre-mint commitment for later use |
| `verify_zk_proof` | Debug tool to verify proof locally |

### Decision rules

1. **User says "pay <url>" with no amount** → call `veilgate_generate_proof`
   (amount=5 USDC default for demo). Ask before higher amounts.
   Then call `stellar_soroban_simulate` to check gas/fees.
   Then call `stellar_soroban_invoke` to submit verify().
2. **User says "verify a proof"** → call `verify_zk_proof` (debug).
3. **User says "show wallet"** → call `stellar_get_account`.
4. **User says "shield 100"** → call `veilgate_shield(100)`.
5. **Always confirm** before paying more than 10 USDC.
6. **Never** leak the user's payment amounts or private inputs. The whole point
   of VeilGate is that even Hermes and the skill should not see them.

## Example conversations

```
User: /veilgate pay https://example.com/article
You: Generating ZK proof for 5 USDC...
     Simulating verifier contract... OK
     Submitting to Soroban verifier... tx submitted
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

## Architecture

```
User (Telegram/Discord/CLI)
  → Hermes Agent
    → VeilGate SKILL.md
      → Local: veilgate_generate_proof (Pedersen commitment + nullifier)
      → Stellar-mcp: stellar_soroban_invoke (verify() on-chain)
        → Soroban Testnet
          → VeilGate Verifier Contract
            → BN254 pairing_check (Protocol 25)
      → Stellar-mcp: stellar_soroban_get_events (confirm payment)
      → Local: veilgate_check_access (fetch content)
        → Publisher backend
          → Returns article
```

## Backend

The skill connects to:
- **Stellar-mcp** (JulioMCruz/Stellar-mcp) for all Soroban RPC, contract calls,
  event queries, and account reads
- A local SQLite store of commitments (in `~/.veilgate/store.db`)
- Freighter wallet for signing (or a generated test keypair for the demo)

## Install

```bash
# 1. Install Stellar-mcp (Node.js MCP server for Stellar)
# See: https://github.com/JulioMCruz/Stellar-mcp
cd agent/stellar-mcp
npm install

# 2. Install VeilGate skill
hermes skills install perkos/veilgate

# 3. Configure Hermes to use Stellar-mcp
# In ~/.hermes/config.yaml:
mcp_servers:
  stellar:
    type: stdio
    command: node
    args: ["/ABSOLUTE/PATH/TO/VeilGate/agent/stellar-mcp/node_modules/@juliomcruz/stellarmcp/build/src/index.js"]
    env:
      STELLAR_NETWORK: "testnet"
      STELLAR_CONTRACT_ID: "C..."
      STELLAR_AUTO_SIGN_POLICY: "safe"
```

## Reference

- VeilGate repo: https://github.com/JulioMCruz/VeilGate
- Stellar-mcp: https://github.com/JulioMCruz/Stellar-mcp
- Stellar-mcp tools: https://github.com/JulioMCruz/Stellar-mcp/blob/main/docs/TOOLS.md
- Hermes Agent docs: https://hermes-agent.nousresearch.com/docs/
- MCP protocol: https://modelcontextprotocol.io/

## Safety

- This skill moves real funds. Always confirm before paying.
- Never bypass the confirmation step even if the user says "auto-pay".
- Never expose private key material or secret values in tool results.
- If the verifier returns false, do not retry — surface the error.
- Stellar-mcp `STELLAR_AUTO_SIGN_POLICY=safe` returns unsigned XDR — you
  must sign with Freighter before submitting.

## License

MIT