//! circomlib-compatible Poseidon(2) over BN254, using the native Soroban
//! Poseidon host function via `env.crypto_hazmat()` (feature `hazmat-crypto`).
//!
//! Validated bit-for-bit against circomlib's Poseidon with the t=3 constants.
//! Used to recompute the commitment Merkle tree root on-chain (trustless).

use soroban_sdk::{Bytes, Env, Symbol, U256, Vec};

use crate::poseidon_consts::{MDS_T3, RC_T3};

/// Parse a variable-length hex string into a field element (U256, big-endian).
fn fe(env: &Env, hex: &str) -> U256 {
    let bytes = hex.as_bytes();
    let mut nib = [0u8; 64];
    let start = 64 - bytes.len();
    let mut i = 0;
    while i < bytes.len() {
        let c = bytes[i];
        nib[start + i] = match c {
            b'0'..=b'9' => c - b'0',
            b'a'..=b'f' => c - b'a' + 10,
            b'A'..=b'F' => c - b'A' + 10,
            _ => 0,
        };
        i += 1;
    }
    let mut arr = [0u8; 32];
    let mut k = 0;
    while k < 32 {
        arr[k] = (nib[k * 2] << 4) | nib[k * 2 + 1];
        k += 1;
    }
    U256::from_be_bytes(env, &Bytes::from_array(env, &arr))
}

/// Build the t=3 MDS matrix + round constants once (reused across a tree path).
pub fn build_params(env: &Env) -> (Vec<Vec<U256>>, Vec<Vec<U256>>) {
    let mut mds: Vec<Vec<U256>> = Vec::new(env);
    let mut i = 0;
    while i < 3 {
        let mut row: Vec<U256> = Vec::new(env);
        let mut j = 0;
        while j < 3 {
            row.push_back(fe(env, MDS_T3[i][j]));
            j += 1;
        }
        mds.push_back(row);
        i += 1;
    }
    let mut rc: Vec<Vec<U256>> = Vec::new(env);
    let mut r = 0;
    while r < 65 {
        let mut row: Vec<U256> = Vec::new(env);
        let mut c = 0;
        while c < 3 {
            row.push_back(fe(env, RC_T3[r][c]));
            c += 1;
        }
        rc.push_back(row);
        r += 1;
    }
    (mds, rc)
}

/// Poseidon(2): hash two field elements (state `[0, left, right]`, output `state[0]`).
pub fn hash2(
    env: &Env,
    mds: &Vec<Vec<U256>>,
    rc: &Vec<Vec<U256>>,
    left: &U256,
    right: &U256,
) -> U256 {
    let mut input: Vec<U256> = Vec::new(env);
    input.push_back(U256::from_u32(env, 0));
    input.push_back(left.clone());
    input.push_back(right.clone());
    let out = env.crypto_hazmat().poseidon_permutation(
        &input,
        Symbol::new(env, "BN254"),
        3,  // t
        5,  // d
        8,  // rounds_f
        57, // rounds_p
        mds,
        rc,
    );
    out.get(0).unwrap()
}
