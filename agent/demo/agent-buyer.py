"""
VeilGate demo buyer agent.

Pays any URL via the VeilGate MCP server. Used in the demo video.

Run:
  python3 -m agent.demo.agent-buyer "https://example.com/premium"
"""

import asyncio
import sys
import os

# Allow importing the MCP server modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "mcp-server"))


async def main():
    from server import handle_pay

    if len(sys.argv) < 2:
        print("Usage: agent-buyer.py <url> [amount_cents]")
        sys.exit(1)

    url = sys.argv[1]
    amount = int(sys.argv[2]) if len(sys.argv) > 2 else 5

    result = await handle_pay({"url": url, "amount_cents": amount})
    for content in result:
        print(content.text)


if __name__ == "__main__":
    asyncio.run(main())