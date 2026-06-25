pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";

// Poseidon(left, right)
template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;
    component h = Poseidon(2);
    h.inputs[0] <== left;
    h.inputs[1] <== right;
    hash <== h.out;
}

// Selects (cur, sibling) ordering based on a 0/1 path bit, without branching.
template DualMux() {
    signal input in[2];
    signal input s;        // selector, constrained to {0,1}
    signal output out[2];
    s * (1 - s) === 0;
    out[0] <== (in[1] - in[0]) * s + in[0];
    out[1] <== (in[0] - in[1]) * s + in[1];
}

// Recompute a Merkle root from a leaf, sibling path and direction bits.
template MerkleProof(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    component selectors[levels];
    component hashers[levels];

    for (var i = 0; i < levels; i++) {
        selectors[i] = DualMux();
        selectors[i].in[0] <== i == 0 ? leaf : hashers[i - 1].hash;
        selectors[i].in[1] <== pathElements[i];
        selectors[i].s <== pathIndices[i];

        hashers[i] = HashLeftRight();
        hashers[i].left <== selectors[i].out[0];
        hashers[i].right <== selectors[i].out[1];
    }

    root <== hashers[levels - 1].hash;
}

// VeilGate withdraw / "pay": prove ownership of an unspent note that sits in the
// pool's commitment tree, reveal its nullifier hash (double-spend tag), and bind
// the payment to a specific recipient (the publisher).
template Withdraw(levels) {
    // ---- public ----
    signal input root;          // pool Merkle root
    signal input nullifierHash; // revealed on-chain, marked spent
    signal input recipient;     // publisher address (bound, anti-malleability)
    // ---- private ----
    signal input nullifier;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // commitment = Poseidon(nullifier, secret)
    component commitment = HashLeftRight();
    commitment.left <== nullifier;
    commitment.right <== secret;

    // nullifierHash = Poseidon(nullifier)
    component nh = Poseidon(1);
    nh.inputs[0] <== nullifier;
    nh.out === nullifierHash;

    // Merkle membership of the commitment under `root`.
    component tree = MerkleProof(levels);
    tree.leaf <== commitment.hash;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }
    tree.root === root;

    // Bind `recipient` into the proof so a relayer/observer cannot re-target the
    // payout. Squaring adds a constraint involving recipient without otherwise
    // affecting the witness.
    signal recipientSquare;
    recipientSquare <== recipient * recipient;
}

component main {public [root, nullifierHash, recipient]} = Withdraw(20);
