"""
VeilGate Soroban helpers.

Build + submit a verify() invocation to the deployed verifier contract.
"""

import os
from stellar_sdk import (
    Server,
    Keypair,
    TransactionBuilder,
    Network,
    Operation,
    scval,
)

TESTNET_RPC = "https://soroban-testnet.stellar.org"
TESTNET_PASSPHRASE = Network.TESTNET_NETWORK_PASSPHRASE


def build_verify_tx(proof_bundle: dict, vk: dict, source_address: str) -> str:
    contract_id = os.environ.get("VEILGATE_VERIFIER_CONTRACT_ID", "")
    if not contract_id:
        raise RuntimeError("VEILGATE_VERIFIER_CONTRACT_ID not set")

    server = Server(TESTNET_RPC)
    account = server.load_account(source_address)
    contract = scval.to_address(contract_id)

    proof_a = bytes.fromhex(proof_bundle["proof"]["a"][2:])
    proof_b = bytes.fromhex(proof_bundle["proof"]["b"][2:])
    proof_c = bytes.fromhex(proof_bundle["proof"]["c"][2:])

    tx = (
        TransactionBuilder(account, network_passphrase=TESTNET_PASSPHRASE, base_fee=100_000)
        .append_invoke_contract_function_op(
            contract=contract,
            function_name="verify",
            parameters=[
                scval.to_bytes(proof_a),
                scval.to_bytes(proof_b),
                scval.to_bytes(proof_c),
                scval.to_bytes(bytes.fromhex(vk["alpha_g1"][2:])),
                scval.to_bytes(bytes.fromhex(vk["beta_g2"][2:])),
                scval.to_bytes(bytes.fromhex(vk["gamma_g2"][2:])),
                scval.to_bytes(bytes.fromhex(vk["delta_g2"][2:])),
            ],
        )
        .set_timeout(30)
        .build()
    )
    return tx.to_xdr()


def submit_soroban_tx(xdr: str, secret: str) -> str:
    """Sign + submit a Soroban transaction. Returns the tx hash."""
    server = Server(TESTNET_RPC)
    keypair = Keypair.from_secret(secret)
    tx = TransactionBuilder.from_xdr(xdr, TESTNET_PASSPHRASE)
    tx.sign(keypair)
    result = server.submit_transaction(tx)
    if result.get("status") == "ERROR":
        raise RuntimeError(f"Soroban submit error: {result}")
    return result["hash"]