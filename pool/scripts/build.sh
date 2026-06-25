#!/usr/bin/env bash
# Compile the withdraw circuit and run a Groth16 (BN128) trusted setup.
# Produces build/withdraw_final.zkey + build/verification_key.json.
set -euo pipefail

CIRCOM="${CIRCOM:-$HOME/.local/bin/circom}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p build

echo "==> [1/5] compile circuit"
"$CIRCOM" circuits/withdraw.circom --r1cs --wasm --sym -o build
npx --yes snarkjs r1cs info build/withdraw.r1cs

echo "==> [2/5] powers of tau (bn128, 2^14)"
if [ ! -f build/pot_final.ptau ]; then
  npx --yes snarkjs powersoftau new bn128 14 build/pot_0.ptau -v
  npx --yes snarkjs powersoftau contribute build/pot_0.ptau build/pot_1.ptau \
    --name="veilgate-1" -v -e="veilgate entropy 1"
  npx --yes snarkjs powersoftau prepare phase2 build/pot_1.ptau build/pot_final.ptau -v
fi

echo "==> [3/5] groth16 setup"
npx --yes snarkjs groth16 setup build/withdraw.r1cs build/pot_final.ptau build/withdraw_0.zkey

echo "==> [4/5] contribute to zkey"
npx --yes snarkjs zkey contribute build/withdraw_0.zkey build/withdraw_final.zkey \
  --name="veilgate-1" -v -e="veilgate entropy 2"

echo "==> [5/5] export verification key"
npx --yes snarkjs zkey export verificationkey build/withdraw_final.zkey build/verification_key.json

echo "Done. Artifacts in pool/build/:"
ls -la build | grep -E "withdraw_final.zkey|verification_key.json|withdraw.r1cs|withdraw_js"
