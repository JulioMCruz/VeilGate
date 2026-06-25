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

export const POOL_ID =
  process.env.NEXT_PUBLIC_POOL_CONTRACT_ID ||
  'CDZGIFZFRFKYIMSPBLA2OSFVD5RIUVVVWRVN5LPAHYHDGH6LOEGKGD7H';
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
async function fetchCommitments(server: rpc.Server): Promise<bigint[]> {
  const latest = await server.getLatestLedger();
  let start = Math.max(1, latest.sequence - 16000);
  const byIndex = new Map<number, bigint>();
  const seen = new Set<string>();
  for (let page = 0; page < 50; page++) {
    const res = await server.getEvents({
      startLedger: start,
      filters: [{ type: 'contract', contractIds: [POOL_ID] }],
      limit: 200,
    });
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

async function invoke(server: rpc.Server, caller: string, fn: string, args: xdr.ScVal[]): Promise<string> {
  const account = await server.getAccount(caller);
  const op = Operation.invokeContractFunction({ contract: POOL_ID, function: fn, args });
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

export interface PayResult {
  depositHash: string;
  withdrawHash: string;
  nullifierHash: string;
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
 * Full trustless flow: deposit the note, rebuild the tree from chain, prove
 * membership in the browser, and withdraw (which pays the publisher).
 * `onStage` reports progress: 'depositing' | 'proving' | 'paying'.
 */
export async function payPrivately(
  from: string,
  publisher: string,
  onStage?: (s: 'depositing' | 'proving' | 'paying') => void
): Promise<PayResult> {
  const server = new rpc.Server(RPC_URL);
  const note = newNote();
  const recipientField = await recipientFieldFor(publisher);
  const nullifierHash = poseidon1([note.nullifier]);

  // 1. deposit (commitment) — contract recomputes the root on-chain
  onStage?.('depositing');
  const commitmentHex = be32hex(note.commitment);
  const depositHash = await invoke(server, from, 'deposit', [
    new Address(from).toScVal(),
    xdr.ScVal.scvBytes(bufFromHex(commitmentHex)),
  ]);

  // 2. rebuild the tree from chain events -> this note's path
  onStage?.('proving');
  const leaves = await fetchCommitments(server);
  const index = leaves.findIndex((c) => c === note.commitment);
  if (index < 0) throw new Error('deposit not yet indexed; retry');
  const { root, pathElements, pathIndices } = pathFor(leaves, index);

  // 3. Groth16 proof (browser) — secret stays local
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

  // 4. withdraw — verifies on-chain against the recent root, pays the publisher.
  //    The contract re-derives the recipient field from `recipient`, so the proof
  //    is bound to this exact account (a swapped recipient fails verification).
  onStage?.('paying');
  const withdrawHash = await invoke(server, from, 'withdraw', [
    xdr.ScVal.scvBytes(bufFromHex(g1(proof.pi_a))),
    xdr.ScVal.scvBytes(bufFromHex(g2(proof.pi_b))),
    xdr.ScVal.scvBytes(bufFromHex(g1(proof.pi_c))),
    xdr.ScVal.scvBytes(bufFromHex(be32hex(root))),
    xdr.ScVal.scvBytes(bufFromHex(be32hex(nullifierHash))),
    new Address(publisher).toScVal(),
  ]);

  return { depositHash, withdrawHash, nullifierHash: be32hex(nullifierHash) };
}
