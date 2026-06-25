#![cfg(test)]
extern crate std;

use super::*;
use crate::test_fixtures as fx;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Bytes, BytesN, Env, String, Vec};

fn hexbytes(hex: &str) -> std::vec::Vec<u8> {
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
        .collect()
}

fn bn32(env: &Env, hex: &str) -> BytesN<32> {
    let mut a = [0u8; 32];
    a.copy_from_slice(&hexbytes(hex));
    BytesN::from_array(env, &a)
}
fn bn64(env: &Env, hex: &str) -> BytesN<64> {
    let mut a = [0u8; 64];
    a.copy_from_slice(&hexbytes(hex));
    BytesN::from_array(env, &a)
}
fn bn128(env: &Env, hex: &str) -> BytesN<128> {
    let mut a = [0u8; 128];
    a.copy_from_slice(&hexbytes(hex));
    BytesN::from_array(env, &a)
}

fn vk_ic(env: &Env) -> Vec<BytesN<64>> {
    let mut v = Vec::new(env);
    for h in fx::VK_IC.iter() {
        v.push_back(bn64(env, h));
    }
    v
}

/// Deploy a pool + a fresh SAC token, mint to a depositor. Returns the pieces.
fn setup(env: &Env) -> (PoolClient<'static>, token::TokenClient<'static>, Address) {
    let issuer = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token_addr = sac.address();
    let token_admin = token::StellarAssetClient::new(env, &token_addr);
    let depositor = Address::generate(env);
    token_admin.mint(&depositor, &10_000_000);

    let pool_id = env.register(
        Pool,
        (
            token_addr.clone(),
            1_000_000i128,
            bn64(env, fx::VK_ALPHA),
            bn128(env, fx::VK_BETA),
            bn128(env, fx::VK_GAMMA),
            bn128(env, fx::VK_DELTA),
            vk_ic(env),
        ),
    );
    (
        PoolClient::new(env, &pool_id),
        token::TokenClient::new(env, &token_addr),
        depositor,
    )
}

#[test]
fn poseidon_matches_circomlib() {
    // circomlib Poseidon([1, 2]).
    let env = Env::default();
    let (mds, rc) = crate::poseidon::build_params(&env);
    let h = crate::poseidon::hash2(
        &env,
        &mds,
        &rc,
        &U256::from_u32(&env, 1),
        &U256::from_u32(&env, 2),
    );
    let expected: Bytes =
        bn32(&env, "115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a").into();
    assert_eq!(h, U256::from_be_bytes(&env, &expected));
}

#[test]
fn deposit_recomputes_the_expected_root() {
    let env = Env::default();
    env.mock_all_auths();
    let (pool, _token, depositor) = setup(&env);

    let idx = pool.deposit(&depositor, &bn32(&env, fx::COMMITMENT));
    assert_eq!(idx, 0, "first leaf is index 0");

    // The contract recomputed the SAME root the off-chain prover used.
    let root = bn32(&env, fx::ROOT);
    assert_eq!(pool.current_root(), root);
    assert!(pool.is_known_root(&root));
    assert!(!pool.is_known_root(&bn32(&env, &"00".repeat(32))));
}

#[test]
fn withdraw_pays_the_bound_recipient() {
    let env = Env::default();
    env.mock_all_auths();
    let (pool, token, depositor) = setup(&env);
    pool.deposit(&depositor, &bn32(&env, fx::COMMITMENT));

    let recipient = Address::from_string(&String::from_str(&env, fx::RECIPIENT));
    assert_eq!(token.balance(&recipient), 0);

    pool.withdraw(
        &bn64(&env, fx::PROOF_A),
        &bn128(&env, fx::PROOF_B),
        &bn64(&env, fx::PROOF_C),
        &bn32(&env, fx::ROOT),
        &bn32(&env, fx::NULLIFIER_HASH),
        &recipient,
    );
    assert_eq!(token.balance(&recipient), 1_000_000, "publisher paid 0.1 XLM");
    assert!(pool.is_spent(&bn32(&env, fx::NULLIFIER_HASH)));
}

#[test]
fn front_run_to_a_different_recipient_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (pool, token, depositor) = setup(&env);
    pool.deposit(&depositor, &bn32(&env, fx::COMMITMENT));

    // Same proof, swapped recipient: the on-chain-derived field no longer matches.
    let attacker = Address::generate(&env);
    let res = pool.try_withdraw(
        &bn64(&env, fx::PROOF_A),
        &bn128(&env, fx::PROOF_B),
        &bn64(&env, fx::PROOF_C),
        &bn32(&env, fx::ROOT),
        &bn32(&env, fx::NULLIFIER_HASH),
        &attacker,
    );
    assert_eq!(res, Err(Ok(soroban_sdk::Error::from(Error::ProofInvalid))));
    assert_eq!(token.balance(&attacker), 0);
    // The legitimate payment is still available — nullifier was not spent.
    assert!(!pool.is_spent(&bn32(&env, fx::NULLIFIER_HASH)));
}

#[test]
fn double_spend_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (pool, _token, depositor) = setup(&env);
    pool.deposit(&depositor, &bn32(&env, fx::COMMITMENT));
    let recipient = Address::from_string(&String::from_str(&env, fx::RECIPIENT));

    let args = (
        bn64(&env, fx::PROOF_A),
        bn128(&env, fx::PROOF_B),
        bn64(&env, fx::PROOF_C),
        bn32(&env, fx::ROOT),
        bn32(&env, fx::NULLIFIER_HASH),
        recipient.clone(),
    );
    pool.withdraw(&args.0, &args.1, &args.2, &args.3, &args.4, &args.5);
    let res = pool.try_withdraw(&args.0, &args.1, &args.2, &args.3, &args.4, &args.5);
    assert_eq!(res, Err(Ok(soroban_sdk::Error::from(Error::NullifierSpent))));
}

#[test]
fn withdraw_against_an_unknown_root_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (pool, _token, depositor) = setup(&env);
    pool.deposit(&depositor, &bn32(&env, fx::COMMITMENT));
    let recipient = Address::from_string(&String::from_str(&env, fx::RECIPIENT));

    // A root the contract never computed.
    let fake_root = bn32(&env, &std::format!("01{}", "00".repeat(31)));
    let res = pool.try_withdraw(
        &bn64(&env, fx::PROOF_A),
        &bn128(&env, fx::PROOF_B),
        &bn64(&env, fx::PROOF_C),
        &fake_root,
        &bn32(&env, fx::NULLIFIER_HASH),
        &recipient,
    );
    assert_eq!(res, Err(Ok(soroban_sdk::Error::from(Error::RootUnknown))));
}

#[test]
fn merkle_keeps_a_root_history() {
    let env = Env::default();
    env.mock_all_auths();
    let (pool, _token, depositor) = setup(&env);

    // First real deposit anchors the fixture root.
    pool.deposit(&depositor, &bn32(&env, fx::COMMITMENT));
    let root_after_1 = pool.current_root();
    assert_eq!(root_after_1, bn32(&env, fx::ROOT));

    // A second deposit moves the current root but the previous one stays known.
    pool.deposit(&depositor, &bn32(&env, &"11".repeat(32)));
    let root_after_2 = pool.current_root();
    assert_ne!(root_after_1, root_after_2);
    assert!(pool.is_known_root(&root_after_1), "old root still in history");
    assert!(pool.is_known_root(&root_after_2));
}
