"""
VeilGate MCP server.

Exposes VeilGate private paywall operations as MCP tools for Hermes Agent.

Transport: stdio (JSON-RPC 2.0)
SDK: mcp (Anthropic Python SDK)
Reference: https://github.com/modelcontextprotocol/python-sdk

Tools:
- veilgate_pay
- veilgate_generate_proof
- veilgate_check_access
- veilgate_wallet_status
- veilgate_history
- veilgate_shield
- verify_zk_proof
"""

import os
import sys
import json
import sqlite3
from typing import Any

# MCP SDK
try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
except ImportError:
    print("error: pip install mcp", file=sys.stderr)
    sys.exit(1)

# Local modules
from proof import generate_payment_proof
from soroban import build_verify_tx, submit_soroban_tx
from wallet import load_wallet, get_balance
from store import init_store, record_payment, get_history

CONTRACT_ID = os.environ.get("VEILGATE_VERIFIER_CONTRACT_ID", "")
NETWORK = os.environ.get("VEILGATE_NETWORK", "testnet")
STORE_PATH = os.environ.get("VEILGATE_STORE", os.path.expanduser("~/.veilgate/store.db"))


server = Server("veilgate-server")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="veilgate_pay",
            description="Pay a Stellar paywall privately using a ZK proof. Returns the content and a private receipt.",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Paywalled URL to unlock"},
                    "amount_cents": {
                        "type": "integer",
                        "description": "Amount in cents (1-255). Default 5.",
                        "minimum": 1,
                        "maximum": 255,
                    },
                },
                "required": ["url"],
            },
        ),
        Tool(
            name="veilgate_generate_proof",
            description="Generate a ZK proof for a payment without submitting.",
            inputSchema={
                "type": "object",
                "properties": {
                    "amount_cents": {"type": "integer", "minimum": 1, "maximum": 255},
                },
                "required": ["amount_cents"],
            },
        ),
        Tool(
            name="veilgate_check_access",
            description="Check if a bearer token grants access to a resource.",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {"type": "string"},
                    "bearer_token": {"type": "string"},
                },
                "required": ["url", "bearer_token"],
            },
        ),
        Tool(
            name="veilgate_wallet_status",
            description="Show Stellar wallet address and USDC balance.",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="veilgate_history",
            description="Show last N payment commitments (amounts NOT stored, by design).",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "default": 10},
                },
            },
        ),
        Tool(
            name="veilgate_shield",
            description="Pre-mint a Pedersen commitment for later use.",
            inputSchema={
                "type": "object",
                "properties": {
                    "amount_cents": {"type": "integer", "minimum": 1, "maximum": 255},
                },
                "required": ["amount_cents"],
            },
        ),
        Tool(
            name="verify_zk_proof",
            description="Verify a ZK proof against the on-chain verifier (debug tool).",
            inputSchema={
                "type": "object",
                "properties": {
                    "proof_a": {"type": "string", "description": "G1 hex (128 chars)"},
                    "proof_b": {"type": "string", "description": "G2 hex (256 chars)"},
                    "proof_c": {"type": "string", "description": "G1 hex (128 chars)"},
                    "public_inputs": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["proof_a", "proof_b", "proof_c", "public_inputs"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    try:
        if name == "veilgate_pay":
            return await handle_pay(arguments)
        elif name == "veilgate_generate_proof":
            return await handle_generate_proof(arguments)
        elif name == "veilgate_check_access":
            return await handle_check_access(arguments)
        elif name == "veilgate_wallet_status":
            return await handle_wallet_status()
        elif name == "veilgate_history":
            return await handle_history(arguments)
        elif name == "veilgate_shield":
            return await handle_shield(arguments)
        elif name == "verify_zk_proof":
            return await handle_verify_proof(arguments)
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def handle_pay(args: dict) -> list[TextContent]:
    url = args["url"]
    amount = args.get("amount_cents", 5)

    # 1. Generate proof
    proof_bundle = generate_payment_proof(amount)

    # 2. Load wallet
    wallet = load_wallet()

    # 3. Build Soroban tx
    if not CONTRACT_ID:
        return [TextContent(type="text", text="VEILGATE_VERIFIER_CONTRACT_ID not set")]

    # Placeholder VK — real one ships with the deployment
    vk = {
        "alpha_g1": "0x" + "0" * 128,
        "beta_g2": "0x" + "0" * 256,
        "gamma_g2": "0x" + "0" * 256,
        "delta_g2": "0x" + "0" * 256,
        "ic": ["0x" + "0" * 128] * 10,
    }

    xdr = build_verify_tx(proof_bundle, vk, wallet["address"])
    tx_hash = submit_soroban_tx(xdr, wallet["secret"])

    # 4. Record commitment (amount NOT stored)
    record_payment(STORE_PATH, proof_bundle["nullifier_hash"], tx_hash, url)

    # 5. Fetch content with bearer
    bearer = f"vg_{tx_hash[:16]}"
    # In production: GET url with Authorization: Bearer <bearer>
    # For demo, return the proof receipt
    return [TextContent(type="text", text=json.dumps({
        "status": "paid",
        "tx_hash": tx_hash,
        "nullifier_hash": proof_bundle["nullifier_hash"],
        "bearer_token": bearer,
        "note": "Amount not revealed (VeilGate privacy guarantee)",
    }, indent=2))]


async def handle_generate_proof(args: dict) -> list[TextContent]:
    amount = args["amount_cents"]
    proof_bundle = generate_payment_proof(amount)
    return [TextContent(type="text", text=json.dumps(proof_bundle, indent=2))]


async def handle_check_access(args: dict) -> list[TextContent]:
    # Placeholder — real impl hits the publisher backend
    return [TextContent(type="text", text=json.dumps({
        "url": args["url"],
        "access": "granted",
        "expires_at": "see token TTL",
    }, indent=2))]


async def handle_wallet_status() -> list[TextContent]:
    wallet = load_wallet()
    balances = get_balance(wallet["address"], NETWORK)
    return [TextContent(type="text", text=json.dumps({
        "address": wallet["address"],
        "network": NETWORK,
        "balances": balances,
    }, indent=2))]


async def handle_history(args: dict) -> list[TextContent]:
    limit = args.get("limit", 10)
    history = get_history(STORE_PATH, limit)
    return [TextContent(type="text", text=json.dumps({
        "payments": history,
        "note": "Amounts are NOT stored by design (VeilGate privacy)",
    }, indent=2))]


async def handle_shield(args: dict) -> list[TextContent]:
    amount = args["amount_cents"]
    proof_bundle = generate_payment_proof(amount)
    return [TextContent(type="text", text=json.dumps({
        "status": "shielded",
        "commitment": proof_bundle["commitment"],
        "nullifier_hash": proof_bundle["nullifier_hash"],
    }, indent=2))]


async def handle_verify_proof(args: dict) -> list[TextContent]:
    # Placeholder — real impl calls soroban verify
    return [TextContent(type="text", text=json.dumps({
        "verified": False,
        "reason": "Placeholder — wire to deployed verifier in production",
    }, indent=2))]


async def main():
    init_store(STORE_PATH)
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())