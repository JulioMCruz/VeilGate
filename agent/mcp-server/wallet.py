"""
VeilGate wallet helpers.

For the demo we use a Stellar keypair from env. In production users would
connect via Freighter (browser extension) or Lobstr (mobile).
"""

import os
from stellar_sdk import Keypair, Server

TESTNET_RPC = "https://horizon-testnet.stellar.org"


def load_wallet() -> dict:
    """Load a Stellar wallet from env. Demo fallback uses the public friendbot
    account on testnet (NEVER USE IN PROD)."""
    secret = os.environ.get("VEILGATE_WALLET_SECRET", "")
    if not secret:
        raise RuntimeError(
            "VEILGATE_WALLET_SECRET not set. "
            "For demo, fund a testnet account via https://friendbot.stellar.org "
            "and set the secret. In production, use Freighter or Lobstr."
        )
    kp = Keypair.from_secret(secret)
    return {
        "address": kp.public_key,
        "secret": secret,
    }


def get_balance(address: str, network: str = "testnet") -> list:
    rpc_url = TESTNET_RPC if network == "testnet" else "https://horizon-public.stellar.org"
    server = Server(rpc_url)
    try:
        account = server.accounts().account_id(address).call()
        return [
            {
                "asset_code": b.get("asset_code", "XLM"),
                "asset_type": b.get("asset_type"),
                "balance": b.get("balance"),
            }
            for b in account.get("balances", [])
        ]
    except Exception as e:
        return [{"error": str(e)}]