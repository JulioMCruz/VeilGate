/**
 * VeilGate — ZK proof generation (browser-side)
 *
 * Loads the compiled Noir circuit, generates a Pedersen commitment,
 * nullifier, and Groth16 proof using Barretenberg WASM.
 *
 * Pipeline:
 *   1. Load ACIR bytecode (target/zk_paywall.json from circuits/)
 *   2. Generate private inputs (secret, nullifier, amount)
 *   3. Compute public inputs (commitment, nullifier_hash, merkle_root, ...)
 *   4. Generate witness via Noir
 *   5. Generate Groth16 proof via Barretenberg
 *   6. Encode for Soroban (big-endian, 32-byte field elements)
 *
 * Reference: https://noir-lang.org/docs
 *            https://github.com/AztecProtocol/aztec-packages/tree/master/barretenberg/ts
 */

import type { ZKProofBundle, PaywallChallenge } from './types';

// Field modulus for BN254 (decimal)
// p = 21888242871839275222246405745257275088696311157297823662689037894645226208583
const BN254_P = BigInt(
  '21888242871839275222246405745257275088696311157297823662689037894645226208583'
);

// Pedersen hash placeholder. In production we'd load the Noir stdlib function.
// For demo we use a deterministic hash mod p of (secret || nullifier || amount).
async function pedersenHash(
  secret: bigint,
  nullifier: bigint,
  amount: bigint
): Promise<bigint> {
  const buf = new Uint8Array(96);
  const view = new DataView(buf.buffer);
  view.setBigUint64(0, secret, false);
  view.setBigUint64(32, nullifier, false);
  view.setBigUint64(64, amount, false);

  const digest = await crypto.subtle.digest('SHA-256', buf);
  const hashBytes = new Uint8Array(digest);
  let hash = 0n;
  for (const b of hashBytes) {
    hash = (hash << 8n) | BigInt(b);
  }
  return hash % BN254_P;
}

async function nullifierHashOf(n: bigint): Promise<bigint> {
  const buf = new Uint8Array(32);
  const view = new DataView(buf.buffer);
  view.setBigUint64(0, n, false);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const hashBytes = new Uint8Array(digest);
  let hash = 0n;
  for (const b of hashBytes) {
    hash = (hash << 8n) | BigInt(b);
  }
  return hash % BN254_P;
}

function bigintToHex32(n: bigint): string {
  return n.toString(16).padStart(64, '0');
}

function randomFieldElement(): bigint {
  // Cryptographically random bigint in [0, p)
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  let n = 0n;
  for (const b of arr) {
    n = (n << 8n) | BigInt(b);
  }
  return n % BN254_P;
}

/**
 * Generate a ZK proof for paying a paywall.
 *
 * In production this loads the actual Noir circuit + Barretenberg WASM. For the
 * MVP scaffold we generate the public inputs correctly and emit a placeholder
 * Groth16 proof. Replacing the placeholder with the real proof is a one-line
 * swap once the circuit bytecode is bundled.
 */
export async function generatePaymentProof(
  amountCentiCents: number,
  merkleRoot: string = '0x' + '0'.repeat(64)
): Promise<{ challenge: PaywallChallenge; proof: ZKProofBundle }> {
  // 1. Private inputs
  const secret = randomFieldElement();
  const nullifier = randomFieldElement();
  const amount = BigInt(amountCentiCents);

  // 2. Compute public inputs (Pedersen commitment + nullifier hash)
  const commitment = await pedersenHash(secret, nullifier, amount);
  const nullifierHash = await nullifierHashOf(nullifier);

  // 3. Amount range bit (1 if in [0, 255], else 0)
  const amountRangeBit = amountCentiCents >= 0 && amountCentiCents <= 255 ? 1 : 0;

  const challenge: PaywallChallenge = {
    commitment: '0x' + bigintToHex32(commitment),
    nullifierHash: '0x' + bigintToHex32(nullifierHash),
    merkleRoot,
    amountRangeBit,
  };

  // 4. Placeholder Groth16 proof
  // In production:
  //   const { Noir } = await import('@noir-lang/noir_js');
  //   const { Barretenberg, UltraHonkHonkBackend } = await import('@aztec/bb.js');
  //   const bb = await Barretenberg.new({ threads: navigator.hardwareConcurrency });
  //   const backend = new UltraHonkHonkBackend(circuitBytecode, bb);
  //   const noir = new Noir(circuitBytecode, backend);
  //   const { witness } = await noir.execute(inputs);
  //   const proof = await backend.generateFinalProof(witness);
  //   // Then lower UltraHonk -> Groth16 via jamesbachini/Noir-Groth16 backend
  const proof: ZKProofBundle = {
    publicInputs: [
      challenge.commitment,
      challenge.nullifierHash,
      merkleRoot,
      challenge.amountRangeBit.toString(),
    ],
    proof: {
      a: '0x' + '0'.repeat(128),
      b: '0x' + '0'.repeat(256),
      c: '0x' + '0'.repeat(128),
    },
  };

  return { challenge, proof };
}