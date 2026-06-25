"use client";

/**
 * useStellarWallet hook — generated via stellar_nextjs_wallet_scaffold
 * Reference: https://github.com/JulioMCruz/Stellar-mcp/docs/STELLAR_NEXTJS_SOROBAN_RESEARCH.md
 *
 * Client-side Freighter integration for Next.js App Router.
 * Wraps @stellar/freighter-api with React state management.
 */

import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  getAddress,
  signTransaction,
  getNetwork,
} from "@stellar/freighter-api";

export interface StellarWallet {
  address: string;
  network: string;
  isConnected: boolean;
}

export function useStellarWallet() {
  const [wallet, setWallet] = useState<StellarWallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const connected = await isConnected();
      if (!connected) {
        throw new Error(
          "Freighter not installed. Install from https://freighter.app"
        );
      }

      const addressResult = await getAddress();
      if (addressResult.error) {
        throw new Error(`Freighter error: ${addressResult.error}`);
      }
      if (!addressResult.address) {
        throw new Error("No address returned from Freighter");
      }

      const networkResult = await getNetwork();
      if (networkResult.error) {
        throw new Error(`Network error: ${networkResult.error}`);
      }

      const walletData: StellarWallet = {
        address: addressResult.address,
        network: networkResult.network || "TESTNET",
        isConnected: true,
      };

      setWallet(walletData);
      return walletData;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet(null);
    setError(null);
  }, []);

  const signTx = useCallback(
    async (xdr: string, networkPassphrase: string): Promise<string> => {
      if (!wallet) {
        throw new Error("Wallet not connected");
      }
      const result = await signTransaction(xdr, {
        networkPassphrase,
      });
      if (result.error) {
        throw new Error(`Sign error: ${result.error}`);
      }
      if (!result.signedTxXdr) {
        throw new Error("No signed transaction returned");
      }
      return result.signedTxXdr;
    },
    [wallet]
  );

  // Auto-connect on mount if Freighter is already authorized
  useEffect(() => {
    const autoConnect = async () => {
      try {
        const connected = await isConnected();
        if (!connected) return;
        const addr = await getAddress();
        if (addr.address) {
          const net = await getNetwork();
          setWallet({
            address: addr.address,
            network: net.network || "TESTNET",
            isConnected: true,
          });
        }
      } catch {
        // Silent fail on auto-connect
      }
    };
    autoConnect();
  }, []);

  return {
    wallet,
    loading,
    error,
    connect,
    disconnect,
    signTx,
    isConnected: !!wallet,
  };
}
