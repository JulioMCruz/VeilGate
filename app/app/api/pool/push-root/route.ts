/**
 * Operator endpoint: publish a Merkle root to the pool (admin-signed).
 *
 * In the MVP the operator/admin anchors roots built off-chain from on-chain
 * deposit events. The admin secret stays server-side (never in the browser).
 * Set POOL_ADMIN_SECRET in the environment.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  rpc,
  TransactionBuilder,
  Networks,
  Operation,
  xdr,
  Keypair,
  BASE_FEE,
} from '@stellar/stellar-sdk';

const POOL_ID =
  process.env.NEXT_PUBLIC_POOL_CONTRACT_ID ||
  'CBAF7SJIQMDEU35NVAZ5TJUH574R2ZC545URGBCDAOLY6YEMFJQNZXAH';
const RPC_URL = 'https://soroban-testnet.stellar.org';

export async function POST(req: NextRequest) {
  const secret = process.env.POOL_ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'POOL_ADMIN_SECRET not configured' },
      { status: 500 }
    );
  }

  let root: string;
  try {
    ({ root } = await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!root || !/^[0-9a-fA-F]{64}$/.test(root)) {
    return NextResponse.json({ error: 'root must be 32-byte hex' }, { status: 400 });
  }

  try {
    const kp = Keypair.fromSecret(secret);
    const server = new rpc.Server(RPC_URL);
    const account = await server.getAccount(kp.publicKey());
    const op = Operation.invokeContractFunction({
      contract: POOL_ID,
      function: 'push_root',
      args: [xdr.ScVal.scvBytes(Buffer.from(root, 'hex'))],
    });
    const built = new TransactionBuilder(account, {
      fee: (Number(BASE_FEE) * 100).toString(),
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(op)
      .setTimeout(60)
      .build();
    const prepared = await server.prepareTransaction(built);
    prepared.sign(kp);
    const res = await server.sendTransaction(prepared);
    if (res.status === 'ERROR') {
      return NextResponse.json({ error: 'submit error' }, { status: 500 });
    }
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const got = await server.getTransaction(res.hash);
      if (got.status === 'SUCCESS') return NextResponse.json({ hash: res.hash });
      if (got.status === 'FAILED')
        return NextResponse.json({ error: 'tx failed' }, { status: 500 });
    }
    return NextResponse.json({ error: 'timeout' }, { status: 504 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'push_root failed' },
      { status: 500 }
    );
  }
}
