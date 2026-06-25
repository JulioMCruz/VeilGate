/**
 * Payment receipts — stored locally, keyed by wallet address.
 *
 * Privacy invariant: NO hidden/secret amount field. The only amount stored is the
 * `denomination` LABEL ("1 XLM"), which is already public on-chain (anyone can see
 * which pool contract was called). Never store the note secret here.
 */

export interface PaymentReceipt {
  nullifier: string;
  commitment: string;
  contentUrl: string;
  publisherDomain: string;
  timestamp: string; // ISO 8601
  proofBytes: number;
  // On-chain settlement facts (present for shielded-pool payments).
  depositHash?: string;
  withdrawHash?: string;
  poolId?: string;
  root?: string; // the recent root the proof verified against
  denomination?: string; // public label, e.g. "1 XLM"
  anonymitySet?: number; // deposits in the pool at settle time
}

const KEY = (address: string) => `veilgate.history.${address}`;

export function loadHistory(address: string): PaymentReceipt[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY(address));
    return raw ? (JSON.parse(raw) as PaymentReceipt[]) : [];
  } catch {
    return [];
  }
}

export function addReceipt(address: string, receipt: PaymentReceipt): PaymentReceipt[] {
  const list = [receipt, ...loadHistory(address)];
  localStorage.setItem(KEY(address), JSON.stringify(list));
  return list;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
