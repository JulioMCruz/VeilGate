/**
 * VeilGate pool settlement (browser) — TRUSTLESS, real on-chain private payment.
 *
 * The pool recomputes the Merkle root on-chain on every deposit (no operator), so
 * the flow is: generate a note → deposit (Freighter) → rebuild the tree from the
 * on-chain deposit events to get this note's path → generate the Groth16 proof in
 * the browser (secret never leaves the device) → withdraw, which verifies the
 * proof against a recent on-chain root and pays the publisher.
 */

'use client';

import { poseidon1, poseidon2 } from 'poseidon-lite';
import {
  rpc,
  TransactionBuilder,
  Networks,
  Operation,
  Address,
  xdr,
  BASE_FEE,
  scValToNative,
} from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import { type Denomination, DEFAULT_DENOMINATION } from './pool-config';
import { addPending, updatePending, removePending, type PendingNote } from './pending';

/** Default pool (the 0.1 XLM denomination), kept for convenience. */
export const POOL_ID =
  process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || DEFAULT_DENOMINATION.poolId;
const RPC_URL = 'https://soroban-testnet.stellar.org';
const LEVELS = 20;
const R = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

const be32hex = (v: bigint) => v.toString(16).padStart(64, '0');
const bufFromHex = (hex: string) => Buffer.from(hex, 'hex');

function randField(): bigint {
  const a = new Uint8Array(31);
  crypto.getRandomValues(a);
  let n = 0n;
  for (const b of a) n = (n << 8n) | BigInt(b);
  return n % R;
}

function g1(p: string[]): string {
  return be32hex(BigInt(p[0])) + be32hex(BigInt(p[1]));
}
function g2(p: string[][]): string {
  return be32hex(BigInt(p[0][1])) + be32hex(BigInt(p[0][0])) + be32hex(BigInt(p[1][1])) + be32hex(BigInt(p[1][0]));
}

export interface Note {
  secret: bigint;
  nullifier: bigint;
  commitment: bigint;
}

export function newNote(): Note {
  const secret = randField();
  const nullifier = randField();
  return { secret, nullifier, commitment: poseidon2([nullifier, secret]) };
}

/** Pre-computed zero-subtree roots for an empty Poseidon tree. */
function zeros(): bigint[] {
  const z = [0n];
  for (let i = 1; i <= LEVELS; i++) z.push(poseidon2([z[i - 1], z[i - 1]]));
  return z;
}

/** Rebuild the tree from all leaves and return the membership path for `index`. */
function pathFor(leaves: bigint[], index: number): {
  root: bigint;
  pathElements: string[];
  pathIndices: number[];
} {
  const z = zeros();
  let cur = leaves.slice();
  let idx = index;
  const pathElements: string[] = [];
  const pathIndices: number[] = [];
  for (let level = 0; level < LEVELS; level++) {
    const sibIdx = idx ^ 1;
    const sibling = sibIdx < cur.length ? cur[sibIdx] : z[level];
    pathElements.push(sibling.toString());
    pathIndices.push(idx & 1);
    const next: bigint[] = [];
    for (let i = 0; i < cur.length; i += 2) {
      const left = cur[i];
      const right = i + 1 < cur.length ? cur[i + 1] : z[level];
      next.push(poseidon2([left, right]));
    }
    cur = next.length ? next : [z[level + 1]];
    idx >>= 1;
  }
  return { root: cur[0], pathElements, pathIndices };
}

/**
 * Read every commitment deposited, in leaf-index order, from chain events.
 * Paginates by advancing the start ledger and de-duplicating by event id, so it
 * handles pools with more deposits than one RPC page returns.
 */
async function fetchCommitments(server: rpc.Server, poolId: string): Promise<bigint[]> {
  const latest = await server.getLatestLedger();
  // The Soroban RPC only retains events for a limited window; a startLedger
  // older than that returns nothing (or errors), so stay inside it. ~9000 ledgers
  // (~12h) is comfortably within testnet retention and covers a demo pool.
  let windowBack = 9000;
  let start = Math.max(1, latest.sequence - windowBack);
  const byIndex = new Map<number, bigint>();
  const seen = new Set<string>();
  for (let page = 0; page < 50; page++) {
    let res;
    try {
      res = await server.getEvents({
        startLedger: start,
        filters: [{ type: 'contract', contractIds: [poolId] }],
        limit: 200,
      });
    } catch {
      // startLedger fell outside retention — narrow the window and retry.
      windowBack = Math.floor(windowBack / 2);
      if (windowBack < 500) break;
      start = Math.max(1, latest.sequence - windowBack);
      continue;
    }
    const evs = res.events ?? [];
    let fresh = 0;
    for (const ev of evs) {
      const id = (ev as { id: string }).id;
      if (seen.has(id)) continue;
      seen.add(id);
      fresh += 1;
      try {
        const topics = (ev.topic ?? []).map((t) => scValToNative(t));
        if (topics[0] !== 'deposit') continue;
        const data = scValToNative(ev.value) as [Uint8Array, number];
        byIndex.set(Number(data[1]), BigInt('0x' + Buffer.from(data[0]).toString('hex')));
      } catch {
        /* skip non-deposit events */
      }
    }
    // Last page (short) or nothing new (single over-full ledger): stop.
    if (evs.length < 200 || fresh === 0) break;
    start = (evs[evs.length - 1] as { ledger: number }).ledger;
  }
  const max = byIndex.size ? Math.max(...byIndex.keys()) : -1;
  const leaves: bigint[] = [];
  for (let i = 0; i <= max; i++) leaves.push(byIndex.get(i) ?? 0n);
  return leaves;
}

async function signAndSend(server: rpc.Server, tx: string): Promise<string> {
  const signed = await signTransaction(tx, { networkPassphrase: Networks.TESTNET });
  if (signed.error) throw new Error(String(signed.error));
  const stx = TransactionBuilder.fromXDR(signed.signedTxXdr, Networks.TESTNET);
  const res = await server.sendTransaction(stx as never);
  if (res.status === 'ERROR') throw new Error(`submit failed: ${JSON.stringify(res.errorResult)}`);
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const got = await server.getTransaction(res.hash);
    if (got.status === 'SUCCESS') return res.hash;
    if (got.status === 'FAILED') throw new Error('transaction failed on-chain');
  }
  throw new Error('transaction timed out');
}

async function invoke(
  server: rpc.Server,
  caller: string,
  poolId: string,
  fn: string,
  args: xdr.ScVal[]
): Promise<string> {
  const account = await server.getAccount(caller);
  const op = Operation.invokeContractFunction({ contract: poolId, function: fn, args });
  const built = new TransactionBuilder(account, {
    fee: (Number(BASE_FEE) * 1000).toString(),
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(op)
    .setTimeout(120)
    .build();
  const prepared = await server.prepareTransaction(built);
  return signAndSend(server, prepared.toXDR());
}

/**
 * Submit the withdraw through the server-side relayer so the payout does NOT
 * originate from the depositor's account (fixes the unlinkability leak, #2).
 * The proof is bound to `recipient`, so the relayer cannot redirect the payment.
 */
async function relayWithdraw(params: {
  piA: string;
  piB: string;
  piC: string;
  root: string;
  nullifierHash: string;
  recipient: string;
  poolId: string;
}): Promise<string> {
  const res = await fetch('/api/relay-withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as { hash?: string; error?: string };
  if (!res.ok || !data.hash) throw new Error(data.error || 'relayer withdraw failed');
  return data.hash;
}

export interface PayResult {
  depositHash: string;
  withdrawHash: string;
  nullifierHash: string;
  /** The recent root the contract verified the proof against. */
  root: string;
  /** Pool the payment settled through. */
  poolId: string;
  /** Groth16/BN254 proof size on the wire (A 64 + B 128 + C 64). */
  proofBytes: number;
  /** Deposits in the pool when this note settled — the anonymity set it blends into. */
  anonymitySet: number;
}

/** How many deposits are currently in a pool — the anonymity set you blend into. */
export async function countDeposits(poolId: string): Promise<number> {
  const server = new rpc.Server(RPC_URL);
  const leaves = await fetchCommitments(server, poolId);
  return leaves.length;
}

/**
 * Field element the proof is bound to = sha256(recipient strkey) with the top
 * byte zeroed (248-bit, always < r). The contract derives the identical value
 * from the `recipient` Address, so a proof only ever pays the intended account.
 */
export async function recipientFieldFor(publisher: string): Promise<bigint> {
  const data = new TextEncoder().encode(publisher);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  digest[0] = 0;
  let n = 0n;
  for (const b of digest) n = (n << 8n) | BigInt(b);
  return n;
}

/**
 * Steps 2–4 of a payment: rebuild the tree from chain, prove membership in the
 * browser, and withdraw (paid via the relayer). Shared by the full pay flow and
 * the retry path (#9). The secret never leaves the device.
 */
async function proveAndWithdraw(
  server: rpc.Server,
  note: Note,
  publisher: string,
  poolId: string,
  onStage?: (s: 'depositing' | 'proving' | 'paying') => void
): Promise<{ withdrawHash: string; nullifierHash: bigint; root: bigint; anonymitySet: number }> {
  // rebuild the tree from chain events -> this note's path
  onStage?.('proving');
  const leaves = await fetchCommitments(server, poolId);
  const index = leaves.findIndex((c) => c === note.commitment);
  if (index < 0) throw new Error('deposit not yet indexed; retry');
  const { root, pathElements, pathIndices } = pathFor(leaves, index);
  const anonymitySet = leaves.length;

  const recipientField = await recipientFieldFor(publisher);
  const nullifierHash = poseidon1([note.nullifier]);

  // Groth16 proof (browser) — secret stays local
  const snarkjs = await import('snarkjs');
  const { proof } = await snarkjs.groth16.fullProve(
    {
      root: root.toString(),
      nullifierHash: nullifierHash.toString(),
      recipient: recipientField.toString(),
      nullifier: note.nullifier.toString(),
      secret: note.secret.toString(),
      pathElements,
      pathIndices,
    },
    '/pool/withdraw.wasm',
    '/pool/withdraw_final.zkey'
  );

  // withdraw — verified on-chain against the recent root, paid via the relayer so
  // the payout does NOT originate from the depositor's account (unlinkable, #2).
  onStage?.('paying');
  const withdrawHash = await relayWithdraw({
    piA: g1(proof.pi_a),
    piB: g2(proof.pi_b),
    piC: g1(proof.pi_c),
    root: be32hex(root),
    nullifierHash: be32hex(nullifierHash),
    recipient: publisher,
    poolId,
  });

  return { withdrawHash, nullifierHash, root, anonymitySet };
}

/**
 * Full trustless flow: deposit the note, rebuild the tree from chain, prove
 * membership in the browser, and withdraw (which pays the publisher).
 * `onStage` reports progress: 'depositing' | 'proving' | 'paying'.
 */
export async function payPrivately(
  from: string,
  publisher: string,
  denom: Denomination,
  onStage?: (s: 'depositing' | 'proving' | 'paying') => void
): Promise<PayResult> {
  const server = new rpc.Server(RPC_URL);
  const poolId = denom.poolId;
  const note = newNote();

  // #8 pre-flight: a payout to a brand-new account must be at least the 1 XLM
  // account-creation minimum, otherwise the on-chain transfer fails AFTER the
  // deposit already executed (stranding funds). Check before depositing.
  const ACCOUNT_MIN_STROOPS = 10_000_000; // 1 XLM base reserve
  let recipientExists = true;
  try {
    await server.getAccount(publisher);
  } catch {
    recipientExists = false;
  }
  if (!recipientExists && denom.stroops < ACCOUNT_MIN_STROOPS) {
    throw new Error(
      `The recipient account doesn't exist on-chain yet, and ${denom.label} can't create it ` +
        `(Stellar needs at least 1 XLM to open a new account). Fund the recipient first, ` +
        `or use the 1 or 10 XLM denomination.`
    );
  }

  // #9: persist the note BEFORE depositing, so a failed/abandoned withdraw can be
  // retried instead of stranding the deposit (the secret never leaves the device).
  const pendingId = be32hex(note.commitment);
  addPending(from, {
    id: pendingId,
    secret: note.secret.toString(),
    nullifier: note.nullifier.toString(),
    commitment: note.commitment.toString(),
    publisher,
    poolId,
    denomLabel: denom.label,
    depositHash: '',
    createdAt: new Date().toISOString(),
  });

  // 1. deposit (commitment) — contract recomputes the root on-chain
  onStage?.('depositing');
  const commitmentHex = be32hex(note.commitment);
  const depositHash = await invoke(server, from, poolId, 'deposit', [
    new Address(from).toScVal(),
    xdr.ScVal.scvBytes(bufFromHex(commitmentHex)),
  ]);
  updatePending(from, pendingId, { depositHash });

  // 2-4. rebuild the tree, prove membership, and withdraw via the relayer.
  const { withdrawHash, nullifierHash, root, anonymitySet } = await proveAndWithdraw(
    server,
    note,
    publisher,
    poolId,
    onStage
  );

  // success — the deposit is settled; drop the persisted note.
  removePending(from, pendingId);

  return {
    depositHash,
    withdrawHash,
    nullifierHash: be32hex(nullifierHash),
    root: be32hex(root),
    poolId,
    proofBytes: 256,
    anonymitySet,
  };
}

/**
 * Retry the withdraw for a previously-deposited note whose withdraw failed or was
 * abandoned (#9). Re-proves membership and submits via the relayer — no new
 * deposit. Clears the persisted note on success.
 */
export async function retryWithdraw(
  from: string,
  pending: PendingNote,
  onStage?: (s: 'depositing' | 'proving' | 'paying') => void
): Promise<PayResult> {
  const server = new rpc.Server(RPC_URL);
  const note: Note = {
    secret: BigInt(pending.secret),
    nullifier: BigInt(pending.nullifier),
    commitment: BigInt(pending.commitment),
  };
  const { withdrawHash, nullifierHash, root, anonymitySet } = await proveAndWithdraw(
    server,
    note,
    pending.publisher,
    pending.poolId,
    onStage
  );
  removePending(from, pending.id);
  return {
    depositHash: pending.depositHash,
    withdrawHash,
    nullifierHash: be32hex(nullifierHash),
    root: be32hex(root),
    poolId: pending.poolId,
    proofBytes: 256,
    anonymitySet,
  };
}
