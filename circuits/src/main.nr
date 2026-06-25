// VeilGate -- Private micropayment paywall circuit (Noir)
//
// Proves, in zero knowledge, that the prover:
//   1. Knows (secret, nullifier, amount) opening a public `commitment`
//      where commitment = Pedersen(secret, nullifier, amount).
//   2. Derived a publisher-bound `nullifier_hash` -- binding the spend to a
//      specific publisher pubkey so a proof cannot be replayed to a different
//      publisher (the binding is enforced, not decorative).
//   3. The `amount` fits in 8 bits (range proof: 0..=255 centi-cents).
//   4. The `commitment` is a member of the publisher's published commitment set
//      (Merkle membership against a public `merkle_root`) -- enforced.
//
// On-chain the verifier sees only the PUBLIC inputs:
//   commitment, nullifier_hash, publisher_pubkey_(x,y), merkle_root,
//   amount_range_bit. The amount itself stays private; only the fact that it is
//   in range is revealed.
//
// Double-spend is prevented OUTSIDE the circuit: the (publisher-bound)
// `nullifier_hash` is revealed and recorded in a spent-set by the gateway. Two
// spends of the same note produce the same nullifier_hash and are rejected.
//
// Noir stdlib reference (verified against nargo 1.0):
//   - std::hash::pedersen_hash : noir-lang.org/docs/noir/standard_library/cryptographic_primitives/hashes

global TREE_DEPTH: u32 = 20;
global AMOUNT_BITS: u32 = 8;

fn main(
    // ===== PUBLIC INPUTS (visible on-chain) =====
    commitment: pub Field,
    nullifier_hash: pub Field,
    publisher_pubkey_x: pub Field,
    publisher_pubkey_y: pub Field,
    merkle_root: pub Field,
    amount_range_bit: pub u8,
    // ===== PRIVATE INPUTS (kept secret) =====
    secret: Field,
    nullifier: Field,
    amount: Field,
    // Merkle membership proof of `commitment` in the published set.
    merkle_path: [Field; TREE_DEPTH],
    merkle_indices: [u1; TREE_DEPTH],
) {
    // -----------------------------------------------------------------
    // 1. Commitment well-formedness.
    // -----------------------------------------------------------------
    let computed_commitment = std::hash::pedersen_hash([secret, nullifier, amount]);
    assert(computed_commitment == commitment, "commitment mismatch");

    // -----------------------------------------------------------------
    // 2. Publisher-bound nullifier hash (REAL binding).
    //    Folding the publisher pubkey into the nullifier hash means a proof
    //    minted for publisher A yields a different nullifier_hash than for
    //    publisher B, so it cannot be replayed across publishers, and the
    //    spent-set is implicitly scoped per publisher.
    // -----------------------------------------------------------------
    let computed_nullifier_hash =
        std::hash::pedersen_hash([nullifier, publisher_pubkey_x, publisher_pubkey_y]);
    assert(computed_nullifier_hash == nullifier_hash, "nullifier/publisher binding mismatch");

    // -----------------------------------------------------------------
    // 3. 8-bit range proof: amount in [0, 255].
    //    Decompose into 8 little-endian bits and reconstruct. If the value did
    //    not fit in 8 bits, the reconstruction would not equal `amount`.
    // -----------------------------------------------------------------
    let bits: [u1; AMOUNT_BITS] = amount.to_le_bits();
    let mut reconstructed: Field = 0;
    let mut weight: Field = 1;
    for i in 0..AMOUNT_BITS {
        reconstructed = reconstructed + (bits[i] as Field) * weight;
        weight = weight * 2;
    }
    assert(reconstructed == amount, "amount not in 8-bit range");
    assert(amount_range_bit == 1, "range bit not set");

    // -----------------------------------------------------------------
    // 4. Merkle membership of `commitment` against the public root (ENFORCED).
    // -----------------------------------------------------------------
    let computed_root = compute_merkle_root(commitment, merkle_path, merkle_indices);
    assert(computed_root == merkle_root, "commitment not in published merkle set");
}

// ============================================================================
// Helpers (also exercised directly by the test suite).
// ============================================================================

/// Recompute a Merkle root from a leaf, its sibling path and the left/right
/// indices. `index[i] == 0` means the running node is the LEFT child at level
/// `i` (sibling on the right); `1` means it is the RIGHT child.
pub fn compute_merkle_root(
    leaf: Field,
    path: [Field; TREE_DEPTH],
    indices: [u1; TREE_DEPTH],
) -> Field {
    let mut current = leaf;
    for i in 0..TREE_DEPTH {
        let sibling = path[i];
        let left = if indices[i] == 0 { current } else { sibling };
        let right = if indices[i] == 0 { sibling } else { current };
        current = std::hash::pedersen_hash([left, right]);
    }
    current
}

/// Pedersen commitment over (secret, nullifier, amount).
pub fn compute_commitment(secret: Field, nullifier: Field, amount: Field) -> Field {
    std::hash::pedersen_hash([secret, nullifier, amount])
}

/// Publisher-bound nullifier hash revealed on-chain.
pub fn compute_nullifier_hash(
    nullifier: Field,
    publisher_pubkey_x: Field,
    publisher_pubkey_y: Field,
) -> Field {
    std::hash::pedersen_hash([nullifier, publisher_pubkey_x, publisher_pubkey_y])
}

// ============================================================================
// Tests -- these EXECUTE main() with concrete witnesses (positive + negative),
// not just helper functions. Run with `nargo test`.
// ============================================================================

#[test]
fn test_valid_payment_proof_succeeds() {
    let secret: Field = 0x1234;
    let nullifier: Field = 0xabcd;
    let amount: Field = 100; // 100 centi-cents, in range
    let pub_x: Field = 0xdead;
    let pub_y: Field = 0xbeef;

    let commitment = compute_commitment(secret, nullifier, amount);
    let nullifier_hash = compute_nullifier_hash(nullifier, pub_x, pub_y);

    // Build a real membership proof: leaf = commitment, all-zero siblings,
    // leaf positioned as the left child at every level.
    let path: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let indices: [u1; TREE_DEPTH] = [0; TREE_DEPTH];
    let root = compute_merkle_root(commitment, path, indices);

    main(
        commitment, nullifier_hash, pub_x, pub_y, root, 1, secret, nullifier, amount, path,
        indices,
    );
}

#[test(should_fail_with = "commitment mismatch")]
fn test_wrong_secret_fails() {
    let secret: Field = 0x1234;
    let nullifier: Field = 0xabcd;
    let amount: Field = 100;
    let pub_x: Field = 0xdead;
    let pub_y: Field = 0xbeef;

    let commitment = compute_commitment(secret, nullifier, amount);
    let nullifier_hash = compute_nullifier_hash(nullifier, pub_x, pub_y);
    let path: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let indices: [u1; TREE_DEPTH] = [0; TREE_DEPTH];
    let root = compute_merkle_root(commitment, path, indices);

    // Prover supplies a DIFFERENT secret than the one opening the commitment.
    let wrong_secret: Field = 0x9999;
    main(
        commitment, nullifier_hash, pub_x, pub_y, root, 1, wrong_secret, nullifier, amount, path,
        indices,
    );
}

#[test(should_fail_with = "nullifier/publisher binding mismatch")]
fn test_replay_to_different_publisher_fails() {
    let secret: Field = 0x1234;
    let nullifier: Field = 0xabcd;
    let amount: Field = 100;
    let pub_x: Field = 0xdead;
    let pub_y: Field = 0xbeef;

    let commitment = compute_commitment(secret, nullifier, amount);
    // nullifier_hash bound to the ORIGINAL publisher...
    let nullifier_hash = compute_nullifier_hash(nullifier, pub_x, pub_y);
    let path: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let indices: [u1; TREE_DEPTH] = [0; TREE_DEPTH];
    let root = compute_merkle_root(commitment, path, indices);

    // ...but the proof is presented to a DIFFERENT publisher (pubkey changed).
    let other_pub_x: Field = 0x1111;
    main(
        commitment, nullifier_hash, other_pub_x, pub_y, root, 1, secret, nullifier, amount, path,
        indices,
    );
}

// `to_le_bits::<8>()` itself constrains the value to 8 bits and traps on an
// out-of-range amount ("Field failed to decompose..."), so we assert only that
// the proof is rejected, without pinning the exact stdlib message.
#[test(should_fail)]
fn test_out_of_range_amount_fails() {
    let secret: Field = 0x1234;
    let nullifier: Field = 0xabcd;
    let amount: Field = 256; // out of 8-bit range
    let pub_x: Field = 0xdead;
    let pub_y: Field = 0xbeef;

    let commitment = compute_commitment(secret, nullifier, amount);
    let nullifier_hash = compute_nullifier_hash(nullifier, pub_x, pub_y);
    let path: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let indices: [u1; TREE_DEPTH] = [0; TREE_DEPTH];
    let root = compute_merkle_root(commitment, path, indices);

    main(
        commitment, nullifier_hash, pub_x, pub_y, root, 1, secret, nullifier, amount, path,
        indices,
    );
}

#[test(should_fail_with = "commitment not in published merkle set")]
fn test_wrong_merkle_root_fails() {
    let secret: Field = 0x1234;
    let nullifier: Field = 0xabcd;
    let amount: Field = 100;
    let pub_x: Field = 0xdead;
    let pub_y: Field = 0xbeef;

    let commitment = compute_commitment(secret, nullifier, amount);
    let nullifier_hash = compute_nullifier_hash(nullifier, pub_x, pub_y);
    let path: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let indices: [u1; TREE_DEPTH] = [0; TREE_DEPTH];

    // A root that does NOT correspond to the commitment's membership proof.
    let bogus_root: Field = 0x123456;
    main(
        commitment, nullifier_hash, pub_x, pub_y, bogus_root, 1, secret, nullifier, amount, path,
        indices,
    );
}
