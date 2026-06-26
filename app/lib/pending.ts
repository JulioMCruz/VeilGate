/**
 * VeilGate — pending-note store (QA finding #9).
 *
 * A pool payment is two steps: deposit, then withdraw. The note secret lives only
 * in the browser, so if the withdraw fails or the tab is closed in between, the
 * deposit is stranded and the funds become unrecoverable. To prevent that, we
 * persist the note (per wallet address) BEFORE depositing and remove it once the
 * withdraw succeeds — so a stuck deposit can always be retried.
 *
 * Only the note material needed to re-prove membership is stored. It never leaves
 * the device.
 */
'use client';

export interface PendingNote {
  /** Stable id = commitment (32-byte hex). */
  id: string;
  secret: string; // decimal string of the bigint
  nullifier: string; // decimal string of the bigint
  commitment: string; // decimal string of the bigint
  publisher: string; // recipient (G…)
  poolId: string; // pool contract (C…)
  denomLabel: string; // e.g. "0.1 XLM"
  depositHash: string; // filled once the deposit lands ('' until then)
  createdAt: string;
}

const KEY = (address: string) => `veilgate.pending.${address}`;

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('veilgate:pending'));
}

export function loadPending(address: string): PendingNote[] {
  try {
    const raw = localStorage.getItem(KEY(address));
    return raw ? (JSON.parse(raw) as PendingNote[]) : [];
  } catch {
    return [];
  }
}

function save(address: string, list: PendingNote[]) {
  try {
    localStorage.setItem(KEY(address), JSON.stringify(list));
    emit();
  } catch {
    /* ignore quota / unavailable storage */
  }
}

export function addPending(address: string, note: PendingNote) {
  const list = loadPending(address);
  if (list.some((p) => p.id === note.id)) return;
  list.push(note);
  save(address, list);
}

export function updatePending(address: string, id: string, patch: Partial<PendingNote>) {
  save(
    address,
    loadPending(address).map((p) => (p.id === id ? { ...p, ...patch } : p))
  );
}

export function removePending(address: string, id: string) {
  save(
    address,
    loadPending(address).filter((p) => p.id !== id)
  );
}
