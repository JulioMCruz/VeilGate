//! VeilGate — Soroban verifier for Groth16 ZK proofs over BN254
//!
//! On-chain verifier that accepts a Groth16 proof over BN254 (alt_bn128) and
//! runs the pairing check via the Soroban BN254 host functions
//! (`env.crypto().bn254()`, introduced in Protocol 25 / CAP-0074).
//!
//! What this contract does:
//! 1. Accepts the proof `(A, B, C)` and the verification key `(α, β, γ, δ, IC)`
//! 2. Computes the linear combination `vk_x = IC[0] + Σ public_input[i] · IC[i+1]`
//! 3. Runs `pairing_check([-A, α, vk_x, C], [B, β, γ, δ])`
//! 4. Returns `true` iff the proof is valid
//!
//! What this contract does NOT do:
//! - It does not move USDC. That's the publisher's job (the off-chain gateway).
//! - It does not store commitments or nullifiers. The Merkle root is passed in
//!   as a public input by the caller. The verifier is a pure function.
//!
//! ## Encoding (Soroban BN254 host, Ethereum-compatible)
//! - G1 (`BytesN<64>`):  `be(X) || be(Y)`, each a 32-byte big-endian Fp element.
//! - G2 (`BytesN<128>`): `be(X) || be(Y)`, each coordinate an Fp2 encoded as
//!   `be(c1) || be(c0)` (imaginary component first).
//! - Scalar / public input (`BytesN<32>`): 32-byte big-endian Fr element.

#![no_std]

use soroban_sdk::crypto::bn254::{Bn254Fr, Bn254G1Affine, Bn254G2Affine};
use soroban_sdk::{contract, contractimpl, BytesN, Env, Vec};

#[contract]
pub struct Verifier;

#[contractimpl]
impl Verifier {
    /// Verify a Groth16 proof over BN254.
    ///
    /// # Arguments
    /// * `proof_a` — G1 point `A` (64 bytes)
    /// * `proof_b` — G2 point `B` (128 bytes)
    /// * `proof_c` — G1 point `C` (64 bytes)
    /// * `vk_alpha` — VK element α (G1, 64 bytes)
    /// * `vk_beta`  — VK element β (G2, 128 bytes)
    /// * `vk_gamma` — VK element γ (G2, 128 bytes)
    /// * `vk_delta` — VK element δ (G2, 128 bytes)
    /// * `vk_ic`    — VK IC points `[IC[0], IC[1], …, IC[N]]` (G1 each).
    ///                Length MUST equal `public_inputs.len() + 1`.
    /// * `public_inputs` — Public input scalars (32 bytes each).
    ///
    /// # Returns
    /// `true` iff the proof satisfies the Groth16 verification equation:
    /// `e(-A, B) · e(α, β) · e(vk_x, γ) · e(C, δ) == 1`.
    ///
    /// # Panics
    /// Traps if `vk_ic` is shorter than `public_inputs.len() + 1`, or if any
    /// point/scalar is not a valid BN254 encoding (enforced by the host).
    pub fn verify(
        env: Env,
        proof_a: BytesN<64>,
        proof_b: BytesN<128>,
        proof_c: BytesN<64>,
        vk_alpha: BytesN<64>,
        vk_beta: BytesN<128>,
        vk_gamma: BytesN<128>,
        vk_delta: BytesN<128>,
        vk_ic: Vec<BytesN<64>>,
        public_inputs: Vec<BytesN<32>>,
    ) -> bool {
        let bn = env.crypto().bn254();

        // Step 1: vk_x = IC[0] + Σ public_input[i] · IC[i+1]
        let mut vk_x = Bn254G1Affine::from_bytes(vk_ic.get(0).expect("vk_ic missing IC[0]"));
        for (i, input) in public_inputs.iter().enumerate() {
            let ic = Bn254G1Affine::from_bytes(
                vk_ic
                    .get((i + 1) as u32)
                    .expect("vk_ic missing IC element for a public input"),
            );
            let scalar = Bn254Fr::from_bytes(input);
            let term = bn.g1_mul(&ic, &scalar);
            vk_x = bn.g1_add(&vk_x, &term);
        }

        // Step 2: -A (native point negation — no hand-rolled field math).
        let neg_a = -Bn254G1Affine::from_bytes(proof_a);

        // Step 3: assemble the four pairs as two parallel vectors.
        //   e(-A, B) · e(α, β) · e(vk_x, γ) · e(C, δ) == 1
        let mut g1: Vec<Bn254G1Affine> = Vec::new(&env);
        g1.push_back(neg_a);
        g1.push_back(Bn254G1Affine::from_bytes(vk_alpha));
        g1.push_back(vk_x);
        g1.push_back(Bn254G1Affine::from_bytes(proof_c));

        let mut g2: Vec<Bn254G2Affine> = Vec::new(&env);
        g2.push_back(Bn254G2Affine::from_bytes(proof_b));
        g2.push_back(Bn254G2Affine::from_bytes(vk_beta));
        g2.push_back(Bn254G2Affine::from_bytes(vk_gamma));
        g2.push_back(Bn254G2Affine::from_bytes(vk_delta));

        // Step 4: multi-pairing check via host function.
        bn.pairing_check(g1, g2)
    }
}

mod test;
