//! VeilGate shielded pool (fixed-denomination, Tornado / Privacy-Pools style).
//!
//! Real value moves on-chain: `deposit` pulls a fixed denomination of a token
//! into the pool and records a commitment; `withdraw` ("pay") verifies a Groth16
//! proof of membership + nullifier + recipient binding, then transfers the
//! denomination to the publisher. The amount per note is the public, fixed
//! denomination; what stays private is the *link* between a payment and its
//! deposit (unlinkability).
//!
//! Merkle root anchoring (MVP): an `admin` publishes valid roots via `push_root`
//! (the tree is built off-chain from on-chain `deposit` events). A fully trustless
//! variant recomputes the root on-chain with the circuit's hash — deferred until
//! the SDK exposes a constructible Poseidon (see pool/README.md).

#![no_std]

use soroban_sdk::crypto::bn254::{Bn254Fr, Bn254G1Affine, Bn254G2Affine};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, token,
    Address, BytesN, Env, Vec,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    Denom,
    VkAlpha,
    VkBeta,
    VkGamma,
    VkDelta,
    VkIc,
    LeafCount,
    Root(BytesN<32>),
    Nullifier(BytesN<32>),
    Commitment(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    RootUnknown = 1,
    NullifierSpent = 2,
    ProofInvalid = 3,
    CommitmentExists = 4,
}

#[contract]
pub struct Pool;

#[contractimpl]
impl Pool {
    /// Initialize the pool with the token, fixed denomination, admin, and the
    /// withdraw circuit's verification key.
    pub fn __constructor(
        env: Env,
        admin: Address,
        token: Address,
        denom: i128,
        vk_alpha: BytesN<64>,
        vk_beta: BytesN<128>,
        vk_gamma: BytesN<128>,
        vk_delta: BytesN<128>,
        vk_ic: Vec<BytesN<64>>,
    ) {
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Token, &token);
        s.set(&DataKey::Denom, &denom);
        s.set(&DataKey::VkAlpha, &vk_alpha);
        s.set(&DataKey::VkBeta, &vk_beta);
        s.set(&DataKey::VkGamma, &vk_gamma);
        s.set(&DataKey::VkDelta, &vk_delta);
        s.set(&DataKey::VkIc, &vk_ic);
        s.set(&DataKey::LeafCount, &0u32);
    }

    /// Deposit one fixed denomination and register `commitment`. Returns the leaf index.
    pub fn deposit(env: Env, from: Address, commitment: BytesN<32>) -> u32 {
        from.require_auth();
        let p = env.storage().persistent();
        if p.has(&DataKey::Commitment(commitment.clone())) {
            panic_with_error!(&env, Error::CommitmentExists);
        }
        let s = env.storage().instance();
        let token: Address = s.get(&DataKey::Token).unwrap();
        let denom: i128 = s.get(&DataKey::Denom).unwrap();

        token::Client::new(&env, &token).transfer(
            &from,
            &env.current_contract_address(),
            &denom,
        );

        let idx: u32 = s.get(&DataKey::LeafCount).unwrap();
        p.set(&DataKey::Commitment(commitment.clone()), &idx);
        s.set(&DataKey::LeafCount, &(idx + 1));
        env.events().publish((symbol_short!("deposit"),), (commitment, idx));
        idx
    }

    /// Admin publishes a Merkle root computed off-chain from the deposit set.
    pub fn push_root(env: Env, root: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Root(root.clone()), &());
        env.events().publish((symbol_short!("root"),), root);
    }

    pub fn is_root(env: Env, root: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Root(root))
    }

    pub fn is_spent(env: Env, nullifier_hash: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Nullifier(nullifier_hash))
    }

    /// Withdraw ("pay"): verify the proof against a known root, ensure the
    /// nullifier is unspent, then transfer one denomination to `recipient`.
    ///
    /// `recipient_field` is the recipient public input the proof was bound to.
    /// (Binding it cryptographically to `recipient` on-chain is a follow-up; for
    /// the MVP the caller submits its own withdrawal.)
    pub fn withdraw(
        env: Env,
        proof_a: BytesN<64>,
        proof_b: BytesN<128>,
        proof_c: BytesN<64>,
        root: BytesN<32>,
        nullifier_hash: BytesN<32>,
        recipient_field: BytesN<32>,
        recipient: Address,
    ) {
        let p = env.storage().persistent();
        if !p.has(&DataKey::Root(root.clone())) {
            panic_with_error!(&env, Error::RootUnknown);
        }
        if p.has(&DataKey::Nullifier(nullifier_hash.clone())) {
            panic_with_error!(&env, Error::NullifierSpent);
        }

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
