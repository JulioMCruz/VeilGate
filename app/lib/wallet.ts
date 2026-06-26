/**
 * VeilGate — Stellar wallet helpers (Freighter wrapper, freighter-api v4).
 *
 * v4 notes:
 *  - isConnected() resolves to { isConnected: boolean } (an object).
 *  - requestAccess() is what prompts the user and returns their address;
 *    getAddress() only returns an address once the app is already allowed.
 */

import {
  isConnected,
  requestAccess,
  signTransaction,
  getNetwork,
} from '@stellar/freighter-api';
import type { WalletAddress } from './types';

/** Best-effort read of the wallet's currently selected network (e.g. 'TESTNET'). */
export async function getWalletNetwork(): Promise<string | null> {
  try {
    const net = await getNetwork();
    if (net.error || !net.network) return null;
    return net.network;
  } catch {
    return null;
  }
}

/** Extract a readable message from a FreighterApiError (object) or string. */
function errMsg(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message) || fallback;
  }
  return fallback;
}

export async function connectWallet(): Promise<WalletAddress> {
  const conn = await isConnected();
  if (conn.error) {
    throw new Error(errMsg(conn.error, 'Could not reach Freighter'));
  }
  if (!conn.isConnected) {
    throw new Error('Freighter not installed. Install from https://freighter.app');
  }

  // Opens the Freighter approval popup and returns the public address.
  const access = await requestAccess();
  if (access.error) {
    throw new Error(errMsg(access.error, 'Connection cancelled in Freighter'));
  }
  if (!access.address) {
    throw new Error('No address returned from Freighter');
  }

  return {
    address: access.address,
    network: (await getWalletNetwork()) ?? 'UNKNOWN',
  };
}

export async function signSorobanTx(
  xdr: string,
  networkPassphrase: string
): Promise<string> {
  const signed = await signTransaction(xdr, { networkPassphrase });
  if (signed.error) {
    throw new Error(errMsg(signed.error, 'Freighter could not sign the transaction'));
  }
  if (!signed.signedTxXdr) {
    throw new Error('No signed transaction returned');
  }
  return signed.signedTxXdr;
}
