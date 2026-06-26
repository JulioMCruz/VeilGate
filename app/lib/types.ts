/**
 * VeilGate shared types
 */

export interface WalletAddress {
  address: string;
  /** Freighter's selected network, e.g. 'TESTNET' | 'PUBLIC' | 'FUTURENET' | 'UNKNOWN'. */
  network: string;
}

export interface PaywallRequest {
  /** URL of the premium content */
  url: string;
  /** Publisher pubkey (X, Y coordinates on BN254) */
  publisherPubkey: { x: string; y: string };
  /** Hash of the price for this content */
  priceHash: string;
}

export interface PaywallChallenge {
  /** Public commitment */
  commitment: string;
  /** Public nullifier hash */
  nullifierHash: string;
  /** Public Merkle root of spent-set */
  merkleRoot: string;
  /** 1 if range proof passed, 0 otherwise */
  amountRangeBit: number;
}

/** A real UltraHonk proof produced in-browser from the Noir circuit. */
export interface UltraHonkProof {
  /** Raw proof bytes (UltraHonk, ~14.5 KB) */
  proof: Uint8Array;
  /** Proof as a 0x-hex string (for display / transport) */
  proofHex: string;
  /** Public inputs in circuit order (6 field elements, 0x-hex each) */
  publicInputs: string[];
  /** Public commitment = Pedersen(secret, nullifier, amount) */
  commitment: string;
  /** Publisher-bound nullifier hash = Pedersen(nullifier, pub_x, pub_y) */
  nullifierHash: string;
}

export interface PaymentReceipt {
  /** Publisher-bound nullifier hash (double-spend tag) */
  nullifierHash: string;
  /** Proof size in bytes (real UltraHonk proof) */
  proofBytes: number;
  /** Whether the proof verified */
  verified: boolean;
  bearerToken: string;
  contentUrl: string;
}