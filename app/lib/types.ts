/**
 * VeilGate shared types
 */

export interface WalletAddress {
  address: string;
  network: 'TESTNET' | 'PUBLIC';
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

export interface ZKProofBundle {
  /** Public inputs in order matching the circuit */
  publicInputs: string[];
  /** Groth16 proof (a, b, c) in Soroban byte format */
  proof: {
    a: string;  // 64 bytes hex
    b: string;  // 128 bytes hex
    c: string;  // 64 bytes hex
  };
}

export interface PaymentReceipt {
  txHash: string;
  nullifierHash: string;
  bearerToken: string;
  contentUrl: string;
}