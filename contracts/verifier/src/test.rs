//! Soroban unit tests for the VeilGate verifier contract.
//!
//! Run with: `cargo test` from `contracts/verifier/`

use soroban_sdk::{BytesN, Env, Vec};

use crate::{Verifier, VerifierClient};

/// Helper: build a zeroed BytesN of size N
fn zero_g1(env: &Env) -> BytesN<64> {
    BytesN::from_array(env, &[0u8; 64])
}

fn zero_g2(env: &Env) -> BytesN<128> {
    BytesN::from_array(env, &[0u8; 128])
}

fn zero_field(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0u8; 32])
}

#[test]
fn test_verify_rejects_zero_proof() {
    let env = Env::default();
    let contract_id = env.register(Verifier, ());

    // Build IC with IC[0] + 5 entries (matching our 5 public inputs)
    let mut vk_ic: Vec<BytesN<64>> = Vec::new(&env);
    vk_ic.push_back(zero_g1(&env));
    for _ in 0..5 {
        vk_ic.push_back(zero_g1(&env));
    }

    let public_inputs: Vec<BytesN<32>> = Vec::from_array(&env, &[zero_field(&env); 5]);

    let client = VerifierClient::new(&env, &contract_id);
    let result: bool = client.verify(
        &zero_g1(&env),       // proof_a
        &zero_g2(&env),       // proof_b
        &zero_g1(&env),       // proof_c
        &zero_g1(&env),       // vk_alpha_g1
        &zero_g2(&env),       // vk_beta_g2
        &zero_g2(&env),       // vk_gamma_g2
        &zero_g2(&env),       // vk_delta_g2
        &vk_ic,               // vk_ic
        &public_inputs,       // public inputs
    );
    assert!(!result, "zero proof must not verify");
}

#[test]
fn test_field_prime_returns_expected_low_bits() {
    let env = Env::default();
    let contract_id = env.register(Verifier, ());
    let client = VerifierClient::new(&env, &contract_id);

    // Last 8 bytes of the BN254 base field prime
    let expected = 0x970e5a18c2d6f3a2u64;
    let actual = client.field_prime();
    assert_eq!(actual, expected);
}

#[test]
fn test_verify_panics_on_short_vk_ic() {
    let env = Env::default();
    let contract_id = env.register(Verifier, ());
    let client = VerifierClient::new(&env, &contract_id);

    // Build IC with only IC[0] (no entries for public inputs)
    let mut vk_ic: Vec<BytesN<64>> = Vec::new(&env);
    vk_ic.push_back(zero_g1(&env));

    let public_inputs: Vec<BytesN<32>> = Vec::from_array(&env, &[zero_field(&env); 1]);

    // Should panic because we're missing IC[1] when 1 public input is provided
    let result: Result<bool, _> = client.try_verify(
        &zero_g1(&env),
        &zero_g2(&env),
        &zero_g1(&env),
        &zero_g1(&env),
        &zero_g2(&env),
        &zero_g2(&env),
        &zero_g2(&env),
        &vk_ic,
        &public_inputs,
    );

    // Expect a host error (panic in contract)
    assert!(result.is_err(), "missing IC entry must cause error");
}