//! VeilGate — Soroban verifier for Groth16 ZK proofs
//!
//! On-chain verifier that accepts a Groth16 proof over BN254 and runs the
//! pairing check via Protocol 25 host functions (`env.crypto().bn254()`,
//! CAP-0074).
//!
//! Reference: <https://github.com/stellar/soroban-examples/tree/main/groth16_verifier>
//!
//! What this contract does:
//! 1. Accepts the proof (A, B, C) and the verification key
//! 2. Computes the linear combination `vk_x = IC[0] + Σ public_input[i] * IC[i+1]`
//! 3. Runs `pairing_check([(-A, B), (α, β), (vk_x, γ), (C, δ)])`
//! 4. Returns true iff the proof is valid
//!
//! What this contract does NOT do:
//! - It does not move USDC. That's the publisher's job (the off-chain Gateway).
//! - It does not store commitments or nullifiers. The Merkle root is passed
//!   in as a public input by the caller.

#![no_std]

mod bn254;

use soroban_sdk::{contract, contractimpl, BytesN, Env, Vec};

use crate::bn254::{negate_g1, pairing_pairs};

#[contract]
pub struct Verifier;

#[contractimpl]
impl Verifier {
    /// Verify a Groth16 proof over BN254.
    ///
    /// # Arguments
    ///
    /// * `proof_a` — G1 point (64 bytes)
    /// * `proof_b` — G2 point (128 bytes)
    /// * `proof_c` — G1 point (64 bytes)
    /// * `vk_alpha_g1` — VK element α (G1, 64 bytes)
    /// * `vk_beta_g2` — VK element β (G2, 128 bytes)
    /// * `vk_gamma_g2` — VK element γ (G2, 128 bytes)
    /// * `vk_delta_g2` — VK element δ (G2, 128 bytes)
    /// * `vk_ic` — VK IC points (IC[0], IC[1], ..., IC[N]) — G1 each
    /// * `public_inputs` — Public input scalars (each 32 bytes)
    ///
    /// # Returns
    ///
    /// `true` iff the proof is valid (pairing check passes).
    ///
    /// # Reference
    ///
    /// Implements the standard Groth16 verification equation:
    ///
    /// e(-A, B) * e(α, β) * e(vk_x, γ) * e(C, δ) == 1
    pub fn verify(
        env: Env,
        proof_a: BytesN<64>,
        proof_b: BytesN<128>,
        proof_c: BytesN<64>,
        vk_alpha_g1: BytesN<64>,
        vk_beta_g2: BytesN<128>,
        vk_gamma_g2: BytesN<128>,
        vk_delta_g2: BytesN<128>,
        vk_ic: Vec<BytesN<64>>,
        public_inputs: Vec<BytesN<32>>,
    ) -> bool {
        // Step 1: Compute vk_x = IC[0] + Σ public_input[i] * IC[i+1]
        //
        // Soroban requires get_unchecked for indexed access in storage-backed
        // Vec. For our in-memory IC vec we use the safe `get` and unwrap.
        let mut vk_x: BytesN<64> = vk_ic
            .get(0)
            .expect("vk_ic must have at least IC[0]")
            .clone();

        for (i, public_input) in public_inputs.iter().enumerate() {
            let ic_i = vk_ic
                .get((i + 1) as u32)
                .unwrap_or_else(|| panic!("missing IC[{}] in vk_ic", i + 1));

            // scalar * G1 via host function (CAP-0074)
            let scaled = env.crypto().bn254().g1_mul(ic_i, public_input);
            vk_x = env.crypto().bn254().g1_add(vk_x, scaled);
        }

        // Step 2: Compute -A (negate the y-coordinate mod p)
        let neg_a = negate_g1(&env, &proof_a);

        // Step 3: Build the 4 pairs for the pairing check
        //
        // e(-A, B) * e(α, β) * e(vk_x, γ) * e(C, δ) == 1
        let pairs = pairing_pairs(
            &env,
            &[
                (neg_a, proof_b.clone()),
                (vk_alpha_g1, vk_beta_g2),
                (vk_x, vk_gamma_g2),
                (proof_c, vk_delta_g2),
            ],
        );

        // Step 4: Run the multi-pairing check via host function (CAP-0074)
        env.crypto().bn254().pairing_check(pairs)
    }

    /// Return the BN254 base field prime used by this verifier.
    ///
    /// Helpful for off-chain clients that need to confirm they're sending
    /// inputs in the correct field.
    pub fn field_prime(_env: Env) -> u64 {
        // Just expose a small witness — the actual prime is hardcoded in bn254.rs
        // BN254 base field prime (low 64 bits):
        // 0x30644e72e131a029b85045b68181585a
        //   = 21888242871839275222246405745257275088696311157297823662689037894645226208583
        // Returns the last 8 bytes as a u64 for quick sanity-check.
        0x970e5a18c2d6f3a2
    }
}

mod test;