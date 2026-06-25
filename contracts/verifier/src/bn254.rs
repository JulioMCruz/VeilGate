//! BN254 byte decoding helpers for Groth16 verification on Soroban.
//!
//! Soroban's BN254 host functions accept points and scalars as fixed-size byte
//! arrays. This module converts from `BytesN<N>` (the Soroban type used for
//! external input) to the host-function expected types.
//!
//! Source: <https://github.com/stellar/soroban-examples/tree/main/groth16_verifier>

use soroban_sdk::{BytesN, Env, IntoVal, Val, Vec};

/// Convert a `BytesN<32>` field element into a `Val` suitable for
/// `env.crypto().bn254().g1_mul()` as the scalar parameter.
///
/// Soroban represents scalar inputs to g1_mul as 32-byte big-endian field
/// elements, which is exactly what `BytesN<32>` already is. This helper just
/// lifts it to a Val.
pub fn scalar_val(env: &Env, scalar: &BytesN<32>) -> Val {
    scalar.into_val(env)
}

/// Build a `Vec<(G1, G2)>` of pairs suitable for `env.crypto().bn254().pairing_check()`.
///
/// Soroban's host function takes a `Vec<(BytesN<64>, BytesN<128>)>` — alternating
/// G1, G2 points — and returns `bool` for the multi-pairing check.
pub fn pairing_pairs(
    env: &Env,
    pairs: &[(BytesN<64>, BytesN<128>)],
) -> Vec<(BytesN<64>, BytesN<128>)> {
    let mut v: Vec<(BytesN<64>, BytesN<128>)> = Vec::new(env);
    for (g1, g2) in pairs {
        v.push_back((g1.clone(), g2.clone()));
    }
    v
}

/// Compute -G1 for a G1 point. The Soroban BN254 host only exposes `g1_add`
/// and `g1_mul`, not negation. To negate a point in the BN254 base field we
/// multiply by the field modulus minus 1: y' = -y mod p.
///
/// In BN254, the base field prime is:
/// p = 21888242871839275222246405745257275088696311157297823662689037894645226208583
///
/// So -G1 = (x, p - y) is computed by negating the y-coordinate.
pub fn negate_g1(env: &Env, p: &BytesN<64>) -> BytesN<64> {
    // BN254 base field prime (decimal)
    const P: [u8; 32] = [
        0x30, 0x64, 0x4e, 0x72, 0xe1, 0x31, 0xa0, 0x29, 0xb8, 0x50, 0x45, 0xb6, 0x81, 0x81, 0x58,
        0x2a, 0x6b, 0x14, 0x35, 0x29, 0x6c, 0x76, 0x19, 0x14, 0xf6, 0x40, 0x47, 0xab, 0x8c, 0x7d,
        0x4c, 0x59,
    ];

    // Source the 64 input bytes into a mutable array
    let src: [u8; 64] = p.to_array();

    // Pull out x[32] and y[32]
    let mut x = [0u8; 32];
    let mut y = [0u8; 32];
    x.copy_from_slice(&src[0..32]);
    y.copy_from_slice(&src[32..64]);

    // Compute p - y as big-endian subtraction (handles borrow via byte loop)
    let mut neg_y = [0u8; 32];
    let mut borrow: u16 = 0;
    for i in (0..32).rev() {
        let pv = P[i] as u16;
        let yv = y[i] as u16;
        // diff = pv - yv - borrow
        let diff = pv as i32 - yv as i32 - borrow as i32;
        if diff < 0 {
            neg_y[i] = (diff + 256) as u8;
            borrow = 1;
        } else {
            neg_y[i] = diff as u8;
            borrow = 0;
        }
    }

    let mut out = [0u8; 64];
    out[0..32].copy_from_slice(&x);
    out[32..64].copy_from_slice(&neg_y);
    BytesN::from_array(env, &out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_negate_g1_basic() {
        let env = Env::default();
        // Construct a known G1: x=1, y=2
        let mut bytes = [0u8; 64];
        bytes[31] = 1; // x = 1
        bytes[63] = 2; // y = 2
        let p = BytesN::<64>::from_array(&env, &bytes);

        let neg = negate_g1(&env, &p);
        let out = neg.to_array();

        // x should be unchanged
        assert_eq!(out[31], 1);

        // y should be p - 2
        // p ends in ...0x4c, 0x59; p - 2 ends in ...0x4a, 0x59
        // Exact check: P[31] = 0x59, y[31] = 2, borrow=0, so 0x59 - 2 = 0x57
        assert_eq!(out[63], 0x57);

        // Make sure x is still 1
        assert_eq!(out[31], 1);
    }

    #[test]
    fn test_negate_g1_with_borrow() {
        let env = Env::default();
        // y = 0x01 means we need to borrow across the whole number
        let mut bytes = [0u8; 64];
        bytes[31] = 5; // x = 5
        bytes[63] = 1; // y = 1
        let p = BytesN::<64>::from_array(&env, &bytes);

        let neg = negate_g1(&env, &p);
        let out = neg.to_array();

        // p - 1 should give the field prime minus 1
        // Expected: P with last byte = 0x58
        assert_eq!(out[63], 0x58);
    }
}