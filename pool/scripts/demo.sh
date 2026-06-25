#!/usr/bin/env bash
#
# End-to-end shielded-pool demo on Stellar testnet:
#   note -> deposit (root recomputed on-chain) -> withdraw (publisher paid).
#
# Usage:
#   SOURCE=<funded stellar key name> PUBLISHER=<G... recipient> [POOL=<C...>] \
#     bash scripts/demo.sh
#
# Default POOL is the 0.1 XLM pool. The note/proof is generated with the same
# circuit VK the pools were deployed with, so it verifies on-chain.

set -euo pipefail

: "${SOURCE:?set SOURCE to a funded stellar key name (stellar keys ...)}"
: "${PUBLISHER:?set PUBLISHER to a G... recipient address}"
POOL="${POOL:-CDZGIFZFRFKYIMSPBLA2OSFVD5RIUVVVWRVN5LPAHYHDGH6LOEGKGD7H}"
NET=testnet
HERE="$(cd "$(dirname "$0")" && pwd)"
ENV=/tmp/pool_demo.env
get() { grep "^$1=" "$ENV" | cut -d= -f2-; }

echo "==> 1. generate a note + withdraw proof bound to $PUBLISHER"
PUBLISHER="$PUBLISHER" node "$HERE/pool_demo.mjs"

echo "==> 2. deposit the commitment (the contract recomputes the Merkle root on-chain)"
stellar contract invoke --id "$POOL" --source "$SOURCE" --network "$NET" -- \
  deposit --from "$SOURCE" --commitment "$(get COMMITMENT)"
echo "    on-chain root : $(stellar contract invoke --id "$POOL" --source "$SOURCE" --network "$NET" -- current_root)"
echo "    prover   root : \"$(get ROOT)\""

echo "==> 3. withdraw -> pays the publisher (proof verified on-chain, no operator)"
stellar contract invoke --id "$POOL" --source "$SOURCE" --network "$NET" -- withdraw \
  --proof_a "$(get PROOF_A)" --proof_b "$(get PROOF_B)" --proof_c "$(get PROOF_C)" \
  --root "$(get ROOT)" --nullifier_hash "$(get NULLIFIER_HASH)" --recipient "$PUBLISHER"

echo "==> done. The publisher was paid; the deposit and the payment are unlinkable on-chain."
