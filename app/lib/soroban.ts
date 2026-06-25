/**
 * VeilGate — Soroban transaction builder + submission
 *
 * Reference: https://developers.stellar.org/docs/build/smart-contracts/invoking-contracts
 */

import { rpc, TransactionBuilder, Networks, Operation, nativeToScVal, Address } from '@stellar/stellar-sdk';

const TESTNET_RPC = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;
const VERIFIER_CONTRACT_ID = process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID ?? '';

/**
 * Build a Soroban transaction that calls verifier.verify() with the given proof.
 */
export async function buildVerifyTx(
  proofBundle: {
    publicInputs: string[];
    proof: { a: string; b: string; c: string };
  },
  vk: {
    alpha_g1: string;
    beta_g2: string;
    gamma_g2: string;
    delta_g2: string;
    ic: string[];
  },
  sourceAddress: string
): Promise<string> {
  if (!VERIFIER_CONTRACT_ID) {
    throw new Error('NEXT_PUBLIC_VERIFIER_CONTRACT_ID not set');
  }

  const server = new rpc.Server(TESTNET_RPC, { allowHttp: false });
  const account = await server.getAccount(sourceAddress);
  const contract = new Address(VERIFIER_CONTRACT_ID);

  // Convert hex strings to Bytes for Soroban
  const proofA = Buffer.from(proofBundle.proof.a.slice(2), 'hex');
  const proofB = Buffer.from(proofBundle.proof.b.slice(2), 'hex');
  const proofC = Buffer.from(proofBundle.proof.c.slice(2), 'hex');

  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contract.toString(),
        function: 'verify',
        args: [
          nativeToScVal(proofA, { type: 'bytes' }),
          nativeToScVal(proofB, { type: 'bytes' }),
          nativeToScVal(proofC, { type: 'bytes' }),
          nativeToScVal(Buffer.from(vk.alpha_g1.slice(2), 'hex'), { type: 'bytes' }),
          nativeToScVal(Buffer.from(vk.beta_g2.slice(2), 'hex'), { type: 'bytes' }),
          nativeToScVal(Buffer.from(vk.gamma_g2.slice(2), 'hex'), { type: 'bytes' }),
          nativeToScVal(Buffer.from(vk.delta_g2.slice(2), 'hex'), { type: 'bytes' }),
          // IC and public inputs are Vec<BytesN> — left to MVP deploy
        ],
      })
    )
    .setTimeout(30)
    .build();

  return tx.toXDR();
}

/**
 * Submit a signed Soroban transaction and wait for confirmation.
 */
export async function submitSorobanTx(signedXdr: string): Promise<string> {
  const server = new rpc.Server(TESTNET_RPC, { allowHttp: false });
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const result = await server.sendTransaction(tx);
  if (result.status === 'ERROR') {
    throw new Error(`Soroban submit error: ${JSON.stringify(result)}`);
  }
  // Poll for confirmation
  let attempts = 0;
  while (attempts < 30) {
    await new Promise((r) => setTimeout(r, 1000));
    const txResult = await server.getTransaction(result.hash);
    if (txResult.status === 'SUCCESS') {
      return result.hash;
    }
    if (txResult.status === 'FAILED') {
      throw new Error(`Soroban tx failed: ${txResult.status}`);
    }
    attempts++;
  }
  throw new Error('Soroban tx timeout');
}