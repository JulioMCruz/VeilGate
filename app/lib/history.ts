/**
 * Payment receipts — stored locally, keyed by wallet address.
 *
 * By design, the receipt has NO `amount` field. Even the user's own history
 * cannot reveal how much was paid. Do not add an amount property here.
 */

export interface PaymentReceipt {
  nullifier: string;
  commitment: string;
  contentUrl: string;
  publisherDomain: string;
  timestamp: string; // ISO 8601
  proofBytes: number;
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
