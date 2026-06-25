"""
VeilGate proof generation.

Pedersen commitment + nullifier + Groth16 placeholder.
Real impl: @noir-lang/noir_js + @aztec/bb.js for the proof.
"""

import hashlib
import secrets
import json


BN254_P = 21888242871839275222246405745257275088696311157297823662689037894645226208583


def _random_field_element() -> int:
    """Cryptographically random bigint in [0, p)."""
    return secrets.randbelow(BN254_P)


def _pedersen_hash(secret: int, nullifier: int, amount: int) -> int:
    """SHA-256 mod p of (secret || nullifier || amount)."""
    h = hashlib.sha256()
    for v in (secret, nullifier, amount):
        h.update(v.to_bytes(32, "big"))
    return int.from_bytes(h.digest(), "big") % BN254_P


def _nullifier_hash(n: int) -> int:
    return int.from_bytes(hashlib.sha256(n.to_bytes(32, "big")).digest(), "big") % BN254_P


def generate_payment_proof(amount_cents: int) -> dict:
    """
    Generate a payment proof.

    Returns dict with:
      - commitment (Pedersen over secret, nullifier, amount)
      - nullifier_hash
      - public_inputs (in order for Soroban verifier)
      - proof (placeholder Groth16 bundle)
    """
    secret = _random_field_element()
    nullifier = _random_field_element()
    amount = amount_cents

    commitment = _pedersen_hash(secret, nullifier, amount)
    nullifier_hash = _nullifier_hash(nullifier)

    amount_range_bit = 1 if 0 <= amount_cents <= 255 else 0
    merkle_root = "0x" + "0" * 64

    return {
        "commitment": "0x" + commitment.to_bytes(32, "big").hex(),
        "nullifier_hash": "0x" + nullifier_hash.to_bytes(32, "big").hex(),
        "public_inputs": [
            "0x" + commitment.to_bytes(32, "big").hex(),
            "0x" + nullifier_hash.to_bytes(32, "big").hex(),
            merkle_root,
            str(amount_range_bit),
        ],
        "proof": {
            "a": "0x" + "0" * 128,
            "b": "0x" + "0" * 256,
            "c": "0x" + "0" * 128,
        },
        "_private": {
            "secret": "0x" + secret.to_bytes(32, "big").hex(),
            "nullifier": "0x" + nullifier.to_bytes(32, "big").hex(),
            "amount": str(amount),
        },
    }