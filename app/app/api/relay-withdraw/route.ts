/**
 * Relayer endpoint for VeilGate pool withdrawals (server-side only).
 *
 * Fixes the unlinkability leak (QA finding #2): the pool `withdraw` is authorized
 * by the Groth16 proof + nullifier + recipient binding, NOT by the depositor's
 * signature — so it can be submitted by any account. Submitting it from a fixed
 * relayer account (instead of the depositor's wallet) breaks the on-chain link
 * between the deposit and the payout.
 *
 * The relayer cannot steal: the proof is bound to `recipient`; swapping it makes
 * the on-chain verification fail. The relayer only pays the fee and submits.
 *
 * RELAYER_SECRET is read from the server environment only and is never exposed to
 * the browser (no NEXT_PUBLIC_ prefix). See app/.env.example.
 */

import { NextResponse } from 'next/server';
import {
  rpc,
  TransactionBuilder,
  Networks,
  Operation,
  Address,
  xdr,
  BASE_FEE,
  Keypair,
} from '@stellar/stellar-sdk';

export const runtime = 'nodejs';

const RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';

const isHex = (s: unknown, len: number): s is string =>
  typeof s === 'string' && new RegExp(`^[0-9a-fA-F]{${len}}$`).test(s);
const isStrKey = (s: unknown): s is string =>
  typeof s === 'string' && /^[GC][A-Z2-7]{55}$/.test(s);

interface RelayBody {
  piA: string; // G1, 64 bytes -> 128 hex chars
  piB: string; // G2, 128 bytes -> 256 hex chars
  piC: string; // G1, 64 bytes -> 128 hex chars
  root: string; // 32 bytes -> 64 hex chars
  nullifierHash: string; // 32 bytes -> 64 hex chars
  recipient: string; // Stellar account (G...)
  poolId: string; // pool contract (C...)
}

export async function POST(req: Request) {
  const secret = process.env.RELAYER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'relayer not configured' }, { status: 500 });
  }

  let body: RelayBody;
  try {
    body = (await req.json()) as RelayBody;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { piA, piB, piC, root, nullifierHash, recipient, poolId } = body;
  if (
    !isHex(piA, 128) ||
    !isHex(piB, 256) ||
    !isHex(piC, 128) ||
    !isHex(root, 64) ||
    !isHex(nullifierHash, 64) ||
    !isStrKey(recipient) ||
    !isStrKey(poolId)
  ) {
    return NextResponse.json({ error: 'invalid withdraw parameters' }, { status: 400 });
  }

  try {
    const kp = Keypair.fromSecret(secret);
    const server = new rpc.Server(RPC_URL);
    const account = await server.getAccount(kp.publicKey());
    const buf = (h: string) => Buffer.from(h, 'hex');

    const op = Operation.invokeContractFunction({
      contract: poolId,
      function: 'withdraw',
      args: [
        xdr.ScVal.scvBytes(buf(piA)),
        xdr.ScVal.scvBytes(buf(piB)),
        xdr.ScVal.scvBytes(buf(piC)),
        xdr.ScVal.scvBytes(buf(root)),
        xdr.ScVal.scvBytes(buf(nullifierHash)),
        new Address(recipient).toScVal(),
      ],
    });

    const built = new TransactionBuilder(account, {
      fee: (Number(BASE_FEE) * 1000).toString(),
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(op)
      .setTimeout(120)
      .build();

    const prepared = await server.prepareTransaction(built);
    prepared.sign(kp);

    const res = await server.sendTransaction(prepared);
    if (res.status === 'ERROR') {
      return NextResponse.json(
        { error: 'submit failed', detail: res.errorResult },
        { status: 502 }
      );
    }

    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const got = await server.getTransaction(res.hash);
      if (got.status === 'SUCCESS') {
        return NextResponse.json({ hash: res.hash });
      }
      if (got.status === 'FAILED') {
        return NextResponse.json({ error: 'withdraw failed on-chain' }, { status: 502 });
      }
    }
    return NextResponse.json({ error: 'withdraw timed out' }, { status: 504 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'relay error' },
      { status: 500 }
    );
  }
}
