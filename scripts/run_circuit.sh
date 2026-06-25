#!/usr/bin/env bash
#
# VeilGate — Noir → Groth16 pipeline
#
# Takes the Noir circuit in circuits/ and emits Groth16 artifacts in
# target/groth16/ that the Soroban verifier can consume.
#
# Pipeline:
#   1. nargo compile       (Noir → ACIR bytecode)
#   2. nargo execute       (run with sample inputs → witness)
#   3. Groth16 setup       (powers of tau + circuit-specific)
#   4. Prove               (witness → Groth16 proof)
#   5. Encode for Soroban  (proof + VK → byte sequences)
#
# Requires:
#   - nargo (Noir 1.0+)
#   - snarkjs (npm install -g snarkjs)
#   - An ACIR -> Groth16 lowering backend binary
#
# Note: for the Noir-native path (no Groth16 conversion) see
#       contracts/ULTRAHONK_ONCHAIN.md instead.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CIRCUITS_DIR="${REPO_ROOT}/circuits"
TARGET_DIR="${REPO_ROOT}/target"
GROTH16_DIR="${TARGET_DIR}/groth16"

echo "==> [1/5] Compiling Noir circuit"
cd "${CIRCUITS_DIR}"
nargo compile
# Produces target/zk_paywall.json

echo "==> [2/5] Generating witness (sample inputs)"
# In real use: write circuits/Prover.toml with private inputs
# then run `nargo execute`. For the MVP we document the flow.
if [ -f "${CIRCUITS_DIR}/Prover.toml" ]; then
  nargo execute witness
else
  echo "    No Prover.toml found — skipping witness generation."
  echo "    Create circuits/Prover.toml with your private inputs to run end-to-end."
fi

echo "==> [3/5] Setting up Groth16 (powers of tau + circuit-specific)"
mkdir -p "${GROTH16_DIR}"
# Powers of tau download (one-time, ~50MB)
PTAU_FILE="${GROTH16_DIR}/powersOfTau28_hez_final_15.ptau"
if [ ! -f "${PTAU_FILE}" ]; then
  echo "    Downloading powers of tau (Hermez ceremony, 2^15 constraints)"
  curl -L \
    "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau" \
    -o "${PTAU_FILE}"
fi

echo "==> [4/5] Generating Groth16 proof"
# Uses an ACIR -> R1CS -> Groth16 lowering backend
NOIR_GROTH16_BIN="${NOIR_GROTH16_BIN:-noir-groth16}"
if command -v "${NOIR_GROTH16_BIN}" >/dev/null 2>&1; then
  "${NOIR_GROTH16_BIN}" prove \
    --circuit "${CIRCUITS_DIR}/target/zk_paywall.json" \
    --witness "${CIRCUITS_DIR}/target/witness.gz" \
    --ptau "${PTAU_FILE}" \
    --out "${GROTH16_DIR}"
  echo "    Artifacts in ${GROTH16_DIR}:"
  ls -la "${GROTH16_DIR}"
else
  echo "    noir-groth16 CLI not found."
  echo "    Set NOIR_GROTH16_BIN=/path/to/your/acir-to-groth16-backend"
fi

echo "==> [5/5] Encoding for Soroban (byte sequences)"
# Scripts/encode_bn254_for_soroban.mjs handles endianness + length prefixes
ENCODE_SCRIPT="${REPO_ROOT}/scripts/encode_bn254_for_soroban.mjs"
if [ -f "${ENCODE_SCRIPT}" ] && [ -f "${GROTH16_DIR}/proof.json" ]; then
  node "${ENCODE_SCRIPT}" \
    --proof "${GROTH16_DIR}/proof.json" \
    --vk "${GROTH16_DIR}/verification_key.json" \
    --public "${GROTH16_DIR}/public.json" \
    --out "${GROTH16_DIR}/soroban_artifacts.json"
  echo "    Soroban-ready artifacts: ${GROTH16_DIR}/soroban_artifacts.json"
else
  echo "    Skipping Soroban encoding (missing encode script or proof)."
  echo "    See scripts/encode_bn254_for_soroban.mjs (TODO: PR #4)."
fi

echo ""
echo "==> Done. To deploy the verifier:"
echo "    cd contracts/verifier"
echo "    stellar contract deploy --wasm target/wasm32-unknown-unknown/release/verifier.wasm --source <key> --network testnet"