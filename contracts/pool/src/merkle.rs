//! Incremental Merkle tree with a recent-root history, maintained ON-CHAIN.
//! The root is recomputed by the contract on every insert using the native
//! Poseidon — so it is anchored to real deposits with no operator and no
//! off-chain trust.

use soroban_sdk::{contracttype, Env, U256, Vec};

use crate::poseidon::{build_params, hash2};

/// Number of recent roots kept so a proof built against a slightly-stale root
/// (a deposit landed between proof generation and submission) still verifies.
pub const ROOT_HISTORY: u32 = 30;

#[contracttype]
#[derive(Clone)]
enum MKey {
    Levels,
    NextIndex,
    CurrentRootIndex,
    FilledSubtrees, // Vec<U256>, length = levels
    Zeros,          // Vec<U256>, length = levels + 1
    Roots,          // Vec<U256>, ring buffer, length = ROOT_HISTORY
}

fn zero(env: &Env) -> U256 {
    U256::from_u32(env, 0)
}

/// Initialize an empty tree of `levels` depth.
pub fn init(env: &Env, levels: u32) {
    let (mds, rc) = build_params(env);

    // zeros[0] = 0; zeros[i] = hash2(zeros[i-1], zeros[i-1])
    let mut zeros: Vec<U256> = Vec::new(env);
    let mut filled: Vec<U256> = Vec::new(env);
    let mut cur = zero(env);
    zeros.push_back(cur.clone());
    let mut i = 0;
    while i < levels {
        filled.push_back(cur.clone());
        cur = hash2(env, &mds, &rc, &cur, &cur);
        zeros.push_back(cur.clone());
        i += 1;
    }
    // initial root = zeros[levels]
    let mut roots: Vec<U256> = Vec::new(env);
    let mut k = 0;
    while k < ROOT_HISTORY {
        roots.push_back(zero(env));
        k += 1;
    }
    roots.set(0, cur);

    let s = env.storage().instance();
    s.set(&MKey::Levels, &levels);
    s.set(&MKey::NextIndex, &0u32);
    s.set(&MKey::CurrentRootIndex, &0u32);
    s.set(&MKey::FilledSubtrees, &filled);
    s.set(&MKey::Zeros, &zeros);
    s.set(&MKey::Roots, &roots);
}

/// Insert a leaf; recompute and store the new root. Returns the leaf index.
/// Returns `None` if the tree is full.
pub fn insert(env: &Env, leaf: U256) -> Option<u32> {
    let s = env.storage().instance();
    let levels: u32 = s.get(&MKey::Levels).unwrap();
    let next: u32 = s.get(&MKey::NextIndex).unwrap();
    if next >= (1u32 << levels) {
        return None;
    }

    let (mds, rc) = build_params(env);
    let zeros: Vec<U256> = s.get(&MKey::Zeros).unwrap();
    let mut filled: Vec<U256> = s.get(&MKey::FilledSubtrees).unwrap();

    let mut idx = next;
    let mut current = leaf;
    let mut i = 0u32;
    while i < levels {
        let (left, right) = if idx % 2 == 0 {
            filled.set(i, current.clone());
            (current.clone(), zeros.get(i).unwrap())
        } else {
            (filled.get(i).unwrap(), current.clone())
        };
        current = hash2(env, &mds, &rc, &left, &right);
        idx /= 2;
        i += 1;
    }

    let cur_root_idx: u32 = s.get(&MKey::CurrentRootIndex).unwrap();
    let new_root_idx = (cur_root_idx + 1) % ROOT_HISTORY;
    let mut roots: Vec<U256> = s.get(&MKey::Roots).unwrap();
    roots.set(new_root_idx, current);

    s.set(&MKey::FilledSubtrees, &filled);
    s.set(&MKey::Roots, &roots);
    s.set(&MKey::CurrentRootIndex, &new_root_idx);
    s.set(&MKey::NextIndex, &(next + 1));
    Some(next)
}

/// Is `root` one of the recent roots? (Anti-forgery: only roots the contract
/// itself computed from real deposits are accepted.)
pub fn is_known_root(env: &Env, root: &U256) -> bool {
    if *root == zero(env) {
        return false;
    }
    let roots: Vec<U256> = env.storage().instance().get(&MKey::Roots).unwrap();
    let mut i = 0u32;
    while i < ROOT_HISTORY {
        if roots.get(i).unwrap() == *root {
            return true;
        }
        i += 1;
    }
    false
}

pub fn current_root(env: &Env) -> U256 {
    let s = env.storage().instance();
    let idx: u32 = s.get(&MKey::CurrentRootIndex).unwrap();
    let roots: Vec<U256> = s.get(&MKey::Roots).unwrap();
    roots.get(idx).unwrap()
}

/// Number of leaves inserted so far.
pub fn leaf_count(env: &Env) -> u32 {
    env.storage().instance().get(&MKey::NextIndex).unwrap()
}
