/**
 * VeilGate pool settlement (browser) — the REAL on-chain private payment.
 *
 * Flow: deposit a fixed denomination of XLM into the pool (registers a commitment),
 * publish the Merkle root (admin, via /api/pool/push-root), then withdraw — which
 * verifies a Groth16 proof on-chain and pays the publisher. The proof is generated
 * IN THE BROWSER (snarkjs), so the note's secret never leaves the device.
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
} from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';

export const POOL_ID =
  process.env.NEXT_PUBLIC_POOL_CONTRACT_ID ||
  'CBAF7SJIQMDEU35NVAZ5TJUH574R2ZC545URGBCDAOLY6YEMFJQNZXAH';
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

export interface WithdrawArtifacts {
  commitmentHex: string;
  rootHex: string;
  nullifierHashHex: string;
  recipientFieldHex: string;
  proof: { a: string; b: string; c: string }; // hex, verifier byte format
}

/** Encode a snarkjs proof point to the verifier's byte format. */
function g1(p: string[]): string {
  return be32hex(BigInt(p[0])) + be32hex(BigInt(p[1]));
}
function g2(p: string[][]): string {
  return be32hex(BigInt(p[0][1])) + be32hex(BigInt(p[0][0])) + be32hex(BigInt(p[1][1])) + be32hex(BigInt(p[1][0]));
}

/**
 * Build a fresh note and generate the withdraw proof (browser, snarkjs).
 * `recipientField` binds the proof to the publisher (a field element).
 */
export async function generateWithdraw(recipientField: bigint): Promise<WithdrawArtifacts> {
  const secret = randField();
  const nullifier = randField();
  const commitment = poseidon2([nullifier, secret]);
  const nullifierHash = poseidon1([nullifier]);

  const zeros: bigint[] = [0n];
  for (let i = 1; i < LEVELS; i++) zeros.push(poseidon2([zeros[i - 1], zeros[i - 1]]));
  const pathElements: string[] = [];
  const pathIndices: number[] = [];
  let node = commitment;
  for (let i = 0; i < LEVELS; i++) {
    pathElements.push(zeros[i].toString());
    pathIndices.push(0);
    node = poseidon2([node, zeros[i]]);
  }
  const root = node;

  const input = {
    root: root.toString(),
    nullifierHash: nullifierHash.toString(),
    recipient: recipientField.toString(),
    nullifier: nullifier.toString(),
    secret: secret.toString(),
    pathElements,
    pathIndices,
  };

  const snarkjs = await import('snarkjs');
  const { proof } = await snarkjs.groth16.fullProve(
    input,
    '/pool/withdraw.wasm',
    '/pool/withdraw_final.zkey'
  );

  return {
    commitmentHex: be32hex(commitment),
    rootHex: be32hex(root),
    nullifierHashHex: be32hex(nullifierHash),
    recipientFieldHex: be32hex(recipientField),
    proof: { a: g1(proof.pi_a), b: g2(proof.pi_b), c: g1(proof.pi_c) },
  };
}

/** Derive the recipient field bound in the proof from a publisher address. */
export function recipientFieldFor(_publisher: string): bigint {
  // MVP: a fixed demo field (matches the value used in pool_demo). Binding this
  // to the actual address on-chain is a follow-up.
  return 0x5075626c6973686572n % R;
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
  caller: string,
  fn: string,
  args: xdr.ScVal[]
): Promise<string> {
  const server = new rpc.Server(RPC_URL);
  const account = await server.getAccount(caller);
  const op = Operation.invokeContractFunction({
    contract: POOL_ID,
    function: fn,
    args,
  });
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

/** deposit(from, commitment) — pulls the fixed denomination of XLM into the pool. */
export async function deposit(from: string, commitmentHex: string): Promise<string> {
  return invoke(from, 'deposit', [
    new Address(from).toScVal(),
    xdr.ScVal.scvBytes(bufFromHex(commitmentHex)),
  ]);
}

/** withdraw(...) — verifies the proof on-chain and pays the publisher. */
export async function withdraw(
  caller: string,
  a: WithdrawArtifacts,
  recipient: string
): Promise<string> {
  return invoke(caller, 'withdraw', [
    xdr.ScVal.scvBytes(bufFromHex(a.proof.a)),
    xdr.ScVal.scvBytes(bufFromHex(a.proof.b)),
    xdr.ScVal.scvBytes(bufFromHex(a.proof.c)),
    xdr.ScVal.scvBytes(bufFromHex(a.rootHex)),
    xdr.ScVal.scvBytes(bufFromHex(a.nullifierHashHex)),
    xdr.ScVal.scvBytes(bufFromHex(a.recipientFieldHex)),
    new Address(recipient).toScVal(),
  ]);
}

/** Ask the operator (server) to publish the Merkle root. */
export async function pushRoot(rootHex: string): Promise<void> {
  const res = await fetch('/api/pool/push-root', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ root: rootHex }),
  });
  if (!res.ok) throw new Error(`push-root failed: ${await res.text()}`);
}
