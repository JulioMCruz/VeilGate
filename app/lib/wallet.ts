/**
 * VeilGate — Stellar wallet helpers (Freighter wrapper)
 *
 * Reference: https://github.com/StellarCN/freighter-api
 */

import {
  isConnected,
  getAddress,
  signTransaction,
} from '@stellar/freighter-api';
import type { WalletAddress } from './types';

export async function connectWallet(): Promise<WalletAddress> {
  const connected = await isConnected();
  if (!connected) {
    throw new Error('Freighter not installed. Install from https://freighter.app');
  }
  const result = await getAddress();
  if (result.error) {
    throw new Error(`Freighter error: ${result.error}`);
  }
  if (!result.address) {
    throw new Error('No address returned from Freighter');
  }
  return {
    address: result.address,
    network: 'TESTNET', // Hardcoded for Stellar Hacks demo
  };
}

export async function signSorobanTx(xdr: string, networkPassphrase: string): Promise<string> {
  const signed = await signTransaction(xdr, {
    networkPassphrase,
  });
  if (signed.error) {
    throw new Error(`Freighter sign error: ${signed.error}`);
  }
  if (!signed.signedTxXdr) {
    throw new Error('No signed transaction returned');
  }
  return signed.signedTxXdr;
}