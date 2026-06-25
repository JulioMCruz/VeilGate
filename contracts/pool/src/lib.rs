//! VeilGate shielded pool (fixed-denomination) — TRUSTLESS variant.
//!
//! Real value moves on-chain: `deposit` pulls a fixed denomination of a token into
//! the pool and inserts a commitment into an on-chain incremental Merkle tree —
//! the contract recomputes the root itself using the native Poseidon
//! (`env.crypto_hazmat()`), so the root is anchored to real deposits with **no
//! operator and no off-chain trust**. `withdraw` ("pay") verifies a Groth16 proof
//! of membership + nullifier + recipient binding against any recent root, then
//! transfers the denomination to the publisher.

#![no_std]

mod merkle;
mod poseidon;
mod poseidon_consts;

#[cfg(test)]
mod test;
#[cfg(test)]
mod test_fixtures;

use soroban_sdk::crypto::bn254::{Bn254Fr, Bn254G1Affine, Bn254G2Affine};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, token,
    Address, Bytes, BytesN, Env, String, Vec, U256,
};

/// Commitment tree depth — must match the withdraw circuit (TREE_DEPTH = 20).
const LEVELS: u32 = 20;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Token,
    Denom,
    VkAlpha,
    VkBeta,
    VkGamma,
    VkDelta,
    VkIc,
    Nullifier(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    RootUnknown = 1,
    NullifierSpent = 2,
    ProofInvalid = 3,
    TreeFull = 4,
}

#[contract]
pub struct Pool;

#[contractimpl]
impl Pool {
    /// Initialize the pool with the token, fixed denomination, and the withdraw
    /// circuit's verification key. Also initializes the on-chain Merkle tree.
    pub fn __constructor(
        env: Env,
        token: Address,
        denom: i128,
        vk_alpha: BytesN<64>,
        vk_beta: BytesN<128>,
        vk_gamma: BytesN<128>,
        vk_delta: BytesN<128>,
        vk_ic: Vec<BytesN<64>>,
    ) {
        let s = env.storage().instance();
        s.set(&DataKey::Token, &token);
        s.set(&DataKey::Denom, &denom);
        s.set(&DataKey::VkAlpha, &vk_alpha);
        s.set(&DataKey::VkBeta, &vk_beta);
        s.set(&DataKey::VkGamma, &vk_gamma);
        s.set(&DataKey::VkDelta, &vk_delta);
        s.set(&DataKey::VkIc, &vk_ic);
        merkle::init(&env, LEVELS);
    }

    /// Deposit one fixed denomination and insert `commitment` into the tree.
    /// The contract recomputes the Merkle root on-chain. Returns the leaf index.
    pub fn deposit(env: Env, from: Address, commitment: BytesN<32>) -> u32 {
        from.require_auth();
        let s = env.storage().instance();
        let token: Address = s.get(&DataKey::Token).unwrap();
        let denom: i128 = s.get(&DataKey::Denom).unwrap();

        token::Client::new(&env, &token).transfer(
            &from,
            &env.current_contract_address(),
            &denom,
        );

        let leaf = bytes32_to_u256(&env, &commitment);
        let idx = match merkle::insert(&env, leaf) {
            Some(i) => i,
            None => panic_with_error!(&env, Error::TreeFull),
        };
        env.events().publish((symbol_short!("deposit"),), (commitment, idx));
        idx
    }

    pub fn is_known_root(env: Env, root: BytesN<32>) -> bool {
        merkle::is_known_root(&env, &bytes32_to_u256(&env, &root))
    }

    pub fn current_root(env: Env) -> BytesN<32> {
        u256_to_bytes32(&env, &merkle::current_root(&env))
    }

    pub fn is_spent(env: Env, nullifier_hash: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Nullifier(nullifier_hash))
    }

    /// Withdraw ("pay"): verify the proof against a recent on-chain root, ensure
    /// the nullifier is unspent, then transfer one denomination to `recipient`.
    ///
    /// The third public input is **derived from `recipient` on-chain** (not taken
    /// from the caller), so the proof is cryptographically bound to who gets paid —
    /// a front-runner that swaps in a different `recipient` invalidates the proof.
    pub fn withdraw(
        env: Env,
        proof_a: BytesN<64>,
        proof_b: BytesN<128>,
        proof_c: BytesN<64>,
        root: BytesN<32>,
        nullifier_hash: BytesN<32>,
        recipient: Address,
    ) {
        if !merkle::is_known_root(&env, &bytes32_to_u256(&env, &root)) {
            panic_with_error!(&env, Error::RootUnknown);
        }
        let p = env.storage().persistent();
        if p.has(&DataKey::Nullifier(nullifier_hash.clone())) {
            panic_with_error!(&env, Error::NullifierSpent);
        }

        let recipient_field = recipient_field_of(&env, &recipient);

        let mut public_inputs: Vec<BytesN<32>> = Vec::new(&env);
        public_inputs.push_back(root);
        public_inputs.push_back(nullifier_hash.clone());
        public_inputs.push_back(recipient_field);

        if !Self::verify_proof(&env, proof_a, proof_b, proof_c, public_inputs) {
            panic_with_error!(&env, Error::ProofInvalid);
        }

        p.set(&DataKey::Nullifier(nullifier_hash.clone()), &());

        let s = env.storage().instance();
        let token: Address = s.get(&DataKey::Token).unwrap();
        let denom: i128 = s.get(&DataKey::Denom).unwrap();
        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &recipient,
            &denom,
        );
        env.events().publish((symbol_short!("withdraw"),), (nullifier_hash, recipient));
    }

    /// Groth16/BN254 verification: e(-A,B)·e(α,β)·e(vk_x,γ)·e(C,δ) == 1.
    fn verify_proof(
        env: &Env,
        proof_a: BytesN<64>,
        proof_b: BytesN<128>,
        proof_c: BytesN<64>,
        public_inputs: Vec<BytesN<32>>,
    ) -> bool {
        let bn = env.crypto().bn254();
        let s = env.storage().instance();
        let vk_alpha: BytesN<64> = s.get(&DataKey::VkAlpha).unwrap();
        let vk_beta: BytesN<128> = s.get(&DataKey::VkBeta).unwrap();
        let vk_gamma: BytesN<128> = s.get(&DataKey::VkGamma).unwrap();
        let vk_delta: BytesN<128> = s.get(&DataKey::VkDelta).unwrap();
        let vk_ic: Vec<BytesN<64>> = s.get(&DataKey::VkIc).unwrap();

        let mut vk_x = Bn254G1Affine::from_bytes(vk_ic.get(0).expect("IC[0]"));
        for (i, input) in public_inputs.iter().enumerate() {
            let ic = Bn254G1Affine::from_bytes(vk_ic.get((i + 1) as u32).expect("IC[i]"));
            let term = bn.g1_mul(&ic, &Bn254Fr::from_bytes(input));
            vk_x = bn.g1_add(&vk_x, &term);
        }

        let neg_a = -Bn254G1Affine::from_bytes(proof_a);
        let mut g1: Vec<Bn254G1Affine> = Vec::new(env);
        g1.push_back(neg_a);
        g1.push_back(Bn254G1Affine::from_bytes(vk_alpha));
        g1.push_back(vk_x);
        g1.push_back(Bn254G1Affine::from_bytes(proof_c));

        let mut g2: Vec<Bn254G2Affine> = Vec::new(env);
        g2.push_back(Bn254G2Affine::from_bytes(proof_b));
        g2.push_back(Bn254G2Affine::from_bytes(vk_beta));
        g2.push_back(Bn254G2Affine::from_bytes(vk_gamma));
        g2.push_back(Bn254G2Affine::from_bytes(vk_delta));

        bn.pairing_check(g1, g2)
    }
}

fn bytes32_to_u256(env: &Env, b: &BytesN<32>) -> U256 {
    let bytes: Bytes = b.clone().into();
    U256::from_be_bytes(env, &bytes)
}

fn u256_to_bytes32(env: &Env, v: &U256) -> BytesN<32> {
    let bytes = v.to_be_bytes();
    let mut arr = [0u8; 32];
    bytes.copy_into_slice(&mut arr);
    BytesN::from_array(env, &arr)
}

/// Derive the proof's `recipient` field element from a recipient Address:
/// `sha256(strkey)` with the top byte zeroed (248-bit, so always < the BN254
/// scalar field). The browser derives the identical value and binds it into the
/// proof, so the proof only verifies for this exact recipient.
fn recipient_field_of(env: &Env, recipient: &Address) -> BytesN<32> {
    let s: String = recipient.to_string();
    let len = s.len() as usize;
    // G... / C... strkeys are 56 chars.
    let mut sbuf = [0u8; 56];
    s.copy_into_slice(&mut sbuf[..len]);
    let bytes = Bytes::from_slice(env, &sbuf[..len]);
    let digest: BytesN<32> = env.crypto().sha256(&bytes).into();
    let mut arr = digest.to_array();
    arr[0] = 0;
    BytesN::from_array(env, &arr)
}
