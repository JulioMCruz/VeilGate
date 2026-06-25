#!/usr/bin/env bash
#
# VeilGate -- regenerate the UltraHonk proof artifacts for on-chain verification.
#
# Produces circuits/target/{vk,proof,public_inputs} (and copies them to
# circuits/artifacts/) from the Noir circuit, using the exact bb flags the
# Soroban UltraHonk verifier expects.
#
# Prereqs (pinned, must match):
#   nargo  1.0.0-beta.9   (noirup -v 1.0.0-beta.9)
#   bb     v0.87.0        (aztec-packages release v0.87.0, NOT aztec-packages-v0.87.0)
#                         binary: barretenberg-<arch>-<os>.tar.gz
#
# Run:
#   ./scripts/build_proof_artifacts.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CIRCUIT_DIR="${REPO_ROOT}/circuits"
BB="${BB:-$HOME/.bb/bb}"

command -v nargo >/dev/null || { echo "nargo not found (need 1.0.0-beta.9)"; exit 1; }
[ -x "$BB" ] || { echo "bb not found at \$BB=$BB (need v0.87.0)"; exit 1; }

cd "${CIRCUIT_DIR}"
echo "==> nargo compile + execute (witness)"
nargo compile
nargo execute   # -> target/zk_paywall.gz

echo "==> bb prove (ultra_honk + keccak)"
"$BB" prove -b target/zk_paywall.json -w target/zk_paywall.gz -o target \
  --scheme ultra_honk --oracle_hash keccak --output_format bytes_and_fields

echo "==> bb write_vk"
"$BB" write_vk -b target/zk_paywall.json -o target \
  --scheme ultra_honk --oracle_hash keccak --output_format bytes_and_fields

echo "==> copy committed artifacts -> circuits/artifacts/"
mkdir -p artifacts
cp target/vk artifacts/vk
cp target/proof artifacts/proof
cp target/public_inputs artifacts/public_inputs

echo "Done:"
ls -la artifacts/
echo "  vk=$(wc -c < artifacts/vk)B  proof=$(wc -c < artifacts/proof)B  public_inputs=$(wc -c < artifacts/public_inputs)B"
echo "See contracts/ULTRAHONK_ONCHAIN.md for deploy + on-chain verify steps."
