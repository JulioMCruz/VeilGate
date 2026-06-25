/**
 * VeilGate — real ZK proof generation (browser-side).
 *
 * Generates a genuine UltraHonk proof of the VeilGate Noir circuit using
 * Barretenberg (bb.js). The public inputs (Pedersen commitment, publisher-bound
 * nullifier hash, Merkle root) are computed with bb.js's Pedersen hash, which is
 * bit-for-bit identical to the circuit's `std::hash::pedersen_hash` — so the
 * witness solver accepts them and the proof is valid.
 *
 * Pipeline:
 *   1. Sample private inputs (secret, nullifier, amount).
 *   2. Compute public inputs with bb.pedersenHash(..., 0):
 *        commitment     = Pedersen(secret, nullifier, amount)
 *        nullifier_hash = Pedersen(nullifier, publisher_x, publisher_y)
 *        merkle_root    = membership root of `commitment` (zero-sibling tree)
 *   3. noir.execute(inputs) -> witness
 *   4. UltraHonkBackend.generateProof(witness) -> real proof + public inputs
 *
 * bb.js runs single-threaded here so the app needs no COOP/COEP headers (which
 * would break Freighter / RPC calls). Proof generation takes a few seconds.
 */

import circuit from './circuit/zk_paywall.json';
import type { UltraHonkProof } from './types';

const TREE_DEPTH = 20;

// BN254 scalar field modulus.
const FIELD_MODULUS = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

/** Demo publisher pubkey — must match the publisher's on-chain challenge. */
export const DEFAULT_PUBLISHER = { x: '0xdead', y: '0xbeef' };

function randomFieldHex(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return '0x' + (n % FIELD_MODULUS).toString(16);
}

function toUint8(proof: Uint8Array): Uint8Array {
  return proof instanceof Uint8Array ? proof : new Uint8Array(proof);
}

function toHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Phases emitted while a proof is being generated (for a live log). */
export type ProofPhase = 'inputs' | 'witness' | 'proving' | 'done';

/**
 * Generate a real UltraHonk proof for a payment of `amountCentiCents` (1..255).
 * `onProgress` is called as each phase starts, so the UI can show a live log.
 */
export async function generatePaymentProof(
  amountCentiCents: number,
  publisher: { x: string; y: string } = DEFAULT_PUBLISHER,
  onProgress?: (phase: ProofPhase) => void
): Promise<UltraHonkProof> {
  if (amountCentiCents < 0 || amountCentiCents > 255) {
    throw new Error('amount must be in [0, 255] (8-bit range proof)');
  }

  const { Barretenberg, Fr, UltraHonkBackend } = await import('@aztec/bb.js');
  const { Noir } = await import('@noir-lang/noir_js');

  onProgress?.('inputs');
  const bb = await Barretenberg.new({ threads: 1 });
  const fr = (h: string | bigint) => new Fr(BigInt(h));

  // 1. private inputs
  const secret = randomFieldHex();
  const nullifier = randomFieldHex();
  const amount = BigInt(amountCentiCents);

  // 2. public inputs via Pedersen (hashIndex 0 == Noir's std::hash::pedersen_hash)
  const commitment = await bb.pedersenHash([fr(secret), fr(nullifier), fr(amount)], 0);
  const nullifierHash = await bb.pedersenHash(
    [fr(nullifier), fr(publisher.x), fr(publisher.y)],
    0
  );

  // Merkle membership of `commitment`: leaf as left child, zero siblings.
  let node = commitment;
  for (let i = 0; i < TREE_DEPTH; i++) {
    node = await bb.pedersenHash([node, fr(0n)], 0);
  }
  const merkleRoot = node;

  const inputs = {
    commitment: commitment.toString(),
    nullifier_hash: nullifierHash.toString(),
    publisher_pubkey_x: publisher.x,
    publisher_pubkey_y: publisher.y,
    merkle_root: merkleRoot.toString(),
    amount_range_bit: '1',
    secret,
    nullifier,
    amount: amount.toString(),
    merkle_path: Array(TREE_DEPTH).fill('0x0'),
    merkle_indices: Array(TREE_DEPTH).fill('0'),
  };

  // 3. solve witness
  onProgress?.('witness');
  const noir = new Noir(circuit as never);
  const { witness } = await noir.execute(inputs);

  // 4. real UltraHonk proof
  onProgress?.('proving');
  const backend = new UltraHonkBackend((circuit as { bytecode: string }).bytecode, {
    threads: 1,
  });
  const { proof, publicInputs } = await backend.generateProof(witness);
  await backend.destroy?.();
  await bb.destroy?.();
  onProgress?.('done');

  const proofBytes = toUint8(proof);
  return {
    proof: proofBytes,
    proofHex: toHex(proofBytes),
    publicInputs,
    commitment: commitment.toString(),
    nullifierHash: nullifierHash.toString(),
  };
}

/**
 * Pre-mint a Pedersen commitment for a future ("shielded") payment. Returns the
 * real commitment + publisher-bound nullifier hash, computed with the same hash
 * the circuit uses. No amount is returned to the caller's storage.
 */
export async function generateShieldCommitment(
  amountCentiCents: number,
  publisher: { x: string; y: string } = DEFAULT_PUBLISHER
): Promise<{ commitment: string; nullifierHash: string }> {
  if (amountCentiCents < 1 || amountCentiCents > 255) {
    throw new Error('amount must be in [1, 255]');
  }
  const { Barretenberg, Fr } = await import('@aztec/bb.js');
  const bb = await Barretenberg.new({ threads: 1 });
  const fr = (h: string | bigint) => new Fr(BigInt(h));
  const secret = randomFieldHex();
  const nullifier = randomFieldHex();
  const commitment = await bb.pedersenHash(
    [fr(secret), fr(nullifier), fr(BigInt(amountCentiCents))],
    0
  );
  const nullifierHash = await bb.pedersenHash(
    [fr(nullifier), fr(publisher.x), fr(publisher.y)],
    0
  );
  await bb.destroy?.();
  return { commitment: commitment.toString(), nullifierHash: nullifierHash.toString() };
}

/**
 * Verify a proof in-browser (sanity check before submitting / unlocking).
 */
export async function verifyPaymentProof(bundle: UltraHonkProof): Promise<boolean> {
  const { UltraHonkBackend } = await import('@aztec/bb.js');
  const backend = new UltraHonkBackend((circuit as { bytecode: string }).bytecode, {
    threads: 1,
  });
  try {
    return await backend.verifyProof({
      proof: bundle.proof,
      publicInputs: bundle.publicInputs,
    });
  } finally {
    await backend.destroy?.();
  }
}
