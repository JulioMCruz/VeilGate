'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { connectWallet, getWalletNetwork } from '@/lib/wallet';

export interface Balance {
  asset: string;
  amount: string;
}

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  /** Wallet's selected network, e.g. 'TESTNET' | 'PUBLIC' | 'UNKNOWN'. null until known. */
  network: string | null;
  balances: Balance[];
  balancesLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

const STORAGE_KEY = 'veilgate.wallet.address';
const HORIZON = 'https://horizon-testnet.stellar.org';

async function fetchBalances(address: string): Promise<Balance[]> {
  try {
    const res = await fetch(`${HORIZON}/accounts/${address}`);
    if (!res.ok) return [{ asset: 'XLM', amount: '0' }];
    const data = await res.json();
    const balances: Balance[] = (data.balances ?? []).map(
      (b: { asset_type: string; asset_code?: string; balance: string }) => ({
        asset: b.asset_type === 'native' ? 'XLM' : b.asset_code ?? 'ASSET',
        amount: b.balance,
      })
    );
    return balances.length ? balances : [{ asset: 'XLM', amount: '0' }];
  } catch {
    return [{ asset: 'XLM', amount: '0' }];
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [network, setNetwork] = useState<string | null>(null);

  // Restore a previous session (address only — never keys).
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) setAddress(saved);
  }, []);

  // Reflect the wallet's actual network whenever connected (incl. restored sessions).
  useEffect(() => {
    if (!address) {
      setNetwork(null);
      return;
    }
    let active = true;
    getWalletNetwork().then((n) => {
      if (active) setNetwork(n);
    });
    return () => {
      active = false;
    };
  }, [address]);

  // Load balances whenever the address changes.
  useEffect(() => {
    if (!address) {
      setBalances([]);
      return;
    }
    let active = true;
    setBalancesLoading(true);
    fetchBalances(address).then((b) => {
      if (active) {
        setBalances(b);
        setBalancesLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [address]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const wallet = await connectWallet();
      setAddress(wallet.address);
      localStorage.setItem(STORAGE_KEY, wallet.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect');
      throw e;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setBalances([]);
    setNetwork(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        isConnecting,
        error,
        network,
        balances,
        balancesLoading,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
