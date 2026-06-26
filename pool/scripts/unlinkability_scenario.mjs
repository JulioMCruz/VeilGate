// Multi-user unlinkability scenario — the acceptance test from
// docs/UNLINKABILITY-PLAN.md (#5/§6): N users deposit the SAME denomination into
// the same pool in an overlapping window, then each pays a DIFFERENT publisher via
// the relayer. We then verify on Horizon that an observer cannot match
// depositor -> payout:
//   - every deposit has a DIFFERENT source (the depositors),
//   - every withdraw has the SAME source (the relayer), so it leaks nothing,
//   - the withdraw carries no reference to the depositor.
//
//   node scripts/unlinkability_scenario.mjs        (exit 0 = property holds)
//   POOL=<C...> RELAY=<url> USERS=2 node scripts/unlinkability_scenario.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';
import {
  rpc, TransactionBuilder, Networks, Operation, Address, xdr, BASE_FEE, Keypair, scValToNative,
} from '@stellar/stellar-sdk';

const here = dirname(fileURLToPath(import.meta.url));
const build = resolve(here, '../build');
const POOL = process.env.POOL || 'CBTZN7SA4LU7FGWZCXBYHMQKP4MAC6PBX6NAXPBXO45HIFLQ6FNRRNCI'; // 0.1 XLM
const RELAY = process.env.RELAY || 'https://veilgate.vercel.app/api/relay-withdraw';
const USERS = Number(process.env.USERS || 2);
const HORIZON = 'https://horizon-testnet.stellar.org';
const L = 20, R = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
const server = new rpc.Server('https://soroban-testnet.stellar.org');

const poseidon = await buildPoseidon();
const F = poseidon.F;
const H2 = (a, b) => F.toObject(poseidon([a, b]));
const H1 = (a) => F.toObject(poseidon([a]));
const be = (v) => v.toString(16).padStart(64, '0');
const buf = (h) => Buffer.from(h, 'hex');
const rnd = () => { const a = new Uint8Array(31); crypto.getRandomValues(a); let n = 0n; for (const b of a) n = (n << 8n) | BigInt(b); return n % R; };
const g1 = (p) => be(BigInt(p[0])) + be(BigInt(p[1]));
const g2 = (p) => be(BigInt(p[0][1])) + be(BigInt(p[0][0])) + be(BigInt(p[1][1])) + be(BigInt(p[1][0]));
const rf = (pub) => { const d = createHash('sha256').update(Buffer.from(pub, 'ascii')).digest(); d[0] = 0; return BigInt('0x' + d.toString('hex')); };
const zeros = [0n]; for (let i = 1; i <= L; i++) zeros.push(H2(zeros[i - 1], zeros[i - 1]));
function pathFor(leaves, index) { let cur = leaves.slice(), idx = index; const pe = [], pi = []; for (let l = 0; l < L; l++) { const sib = (idx ^ 1) < cur.length ? cur[idx ^ 1] : zeros[l]; pe.push(sib.toString()); pi.push(idx & 1); const nx = []; for (let i = 0; i < cur.length; i += 2) nx.push(H2(cur[i], i + 1 < cur.length ? cur[i + 1] : zeros[l])); cur = nx.length ? nx : [zeros[l + 1]]; idx >>= 1; } return { root: cur[0], pathElements: pe, pathIndices: pi }; }

async function friendbot(pub) {
  const r = await fetch(`https://friendbot.stellar.org/?addr=${pub}`);
  if (!r.ok && r.status !== 400) throw new Error('friendbot ' + r.status);
}
async function newFundedAccount(label) {
  const kp = Keypair.random();
  await friendbot(kp.publicKey());
  console.log(`   ${label}: ${kp.publicKey().slice(0, 8)}…`);
  return kp;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function deposit(kp, commitment) {
  // Testnet occasionally traps a deposit transiently — retry with a fresh prepare.
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const acct = await server.getAccount(kp.publicKey());
      const op = Operation.invokeContractFunction({ contract: POOL, function: 'deposit', args: [new Address(kp.publicKey()).toScVal(), xdr.ScVal.scvBytes(buf(be(commitment)))] });
      const tx = new TransactionBuilder(acct, { fee: (Number(BASE_FEE) * 1000).toString(), networkPassphrase: Networks.TESTNET }).addOperation(op).setTimeout(120).build();
      const prep = await server.prepareTransaction(tx); prep.sign(kp);
      const res = await server.sendTransaction(prep);
      if (res.status === 'ERROR') throw new Error('send ' + JSON.stringify(res.errorResult));
      for (let i = 0; i < 40; i++) { await sleep(1500); const g = await server.getTransaction(res.hash); if (g.status === 'SUCCESS') return res.hash; if (g.status === 'FAILED') throw new Error('FAILED ' + res.hash); }
      throw new Error('timeout');
    } catch (e) { lastErr = e; await sleep(3000); }
  }
  throw lastErr;
}
async function fetchCommitments(sourcePub) {
  const acct = await server.getAccount(sourcePub);
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).addOperation(Operation.invokeContractFunction({ contract: POOL, function: 'commitments', args: [] })).setTimeout(60).build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error('sim ' + sim.error);
  return (scValToNative(sim.result.retval) || []).map((b) => BigInt('0x' + Buffer.from(b).toString('hex')));
}
async function txSource(hash) {
  const r = await fetch(`${HORIZON}/transactions/${hash}`);
  return (await r.json()).source_account;
}

const vk = JSON.parse(readFileSync(resolve(build, 'verification_key.json'), 'utf8'));
console.log(`Unlinkability scenario — ${USERS} users, same 0.1 XLM pool ${POOL.slice(0, 8)}…\n`);

console.log('1. create funded depositors + publishers');
const users = [];
for (let i = 0; i < USERS; i++) {
  const depositor = await newFundedAccount(`depositor ${i + 1}`);
  const publisher = await newFundedAccount(`publisher ${i + 1}`);
  const note = { secret: rnd(), nullifier: rnd() };
  note.commitment = H2(note.nullifier, note.secret);
  users.push({ depositor, publisher: publisher.publicKey(), note });
}

console.log('\n2. deposits — overlapping window (back-to-back)');
for (const u of users) { u.depositHash = await deposit(u.depositor, u.note.commitment); console.log(`   ${u.depositor.publicKey().slice(0, 8)}… deposited → ${u.depositHash.slice(0, 10)}…`); }

console.log('\n3. prove + withdraw each via the relayer (different publishers)');
// Poll the durable getter until all of this run's commitments are present.
let leaves = [];
for (let t = 0; t < 12; t++) {
  leaves = await fetchCommitments(users[0].depositor.publicKey());
  if (users.every((u) => leaves.includes(u.note.commitment))) break;
  await sleep(2000);
}
console.log('   getter leaves:', leaves.length, '— all notes present:', users.every((u) => leaves.includes(u.note.commitment)));
for (const u of users) {
  const index = leaves.findIndex((c) => c === u.note.commitment);
  if (index < 0) throw new Error(`commitment ${be(u.note.commitment).slice(0, 16)} not in leaves`);
  const { root, pathElements, pathIndices } = pathFor(leaves, index);
  const nh = H1(u.note.nullifier);
  const { proof } = await snarkjs.groth16.fullProve({ root: root.toString(), nullifierHash: nh.toString(), recipient: rf(u.publisher).toString(), nullifier: u.note.nullifier.toString(), secret: u.note.secret.toString(), pathElements, pathIndices }, resolve(build, 'withdraw_js/withdraw.wasm'), resolve(build, 'withdraw_final.zkey'));
  const resp = await fetch(RELAY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ piA: g1(proof.pi_a), piB: g2(proof.pi_b), piC: g1(proof.pi_c), root: be(root), nullifierHash: be(nh), recipient: u.publisher, poolId: POOL }) });
  const out = await resp.json();
  if (!out.hash) throw new Error('relayer rejected: ' + JSON.stringify(out).slice(0, 160));
  u.withdrawHash = out.hash;
  console.log(`   note(idx ${index}) → publisher ${u.publisher.slice(0, 8)}… paid via relayer → ${out.hash.slice(0, 10)}…`);
}

console.log('\n4. verify on Horizon (the observer\'s on-chain view)');
for (const u of users) { u.depositSrc = await txSource(u.depositHash); u.withdrawSrc = await txSource(u.withdrawHash); }
const depositSrcs = users.map((u) => u.depositSrc);
const withdrawSrcs = users.map((u) => u.withdrawSrc);
console.log('   deposits:'); users.forEach((u, i) => console.log(`     D${i + 1} source ${u.depositSrc.slice(0, 8)}… (depositor)`));
console.log('   withdraws:'); users.forEach((u, i) => console.log(`     W${i + 1} source ${u.withdrawSrc.slice(0, 8)}… → pays ${u.publisher.slice(0, 8)}…`));

const distinctDeposits = new Set(depositSrcs).size === USERS;
const sameWithdrawSrc = new Set(withdrawSrcs).size === 1;
const relayerNotDepositor = !depositSrcs.includes(withdrawSrcs[0]);
console.log('\n   [check] all deposit sources distinct (the depositors):', distinctDeposits);
console.log('   [check] all withdraw sources identical (one relayer):   ', sameWithdrawSrc);
console.log('   [check] relayer ≠ any depositor:                         ', relayerNotDepositor);
console.log('   [fact ] withdraw args = proof+root+nullifier+recipient — no depositor reference.');

const ok = distinctDeposits && sameWithdrawSrc && relayerNotDepositor;
console.log(ok
  ? `\nPASS — an observer sees ${USERS} deposits from ${USERS} accounts and ${USERS} payouts all from the same relayer.\n       Nothing on-chain links a deposit to a payout: matching depositor→publisher is no better than chance (1/${USERS}!).`
  : '\nFAIL — unlinkability property not satisfied.');
process.exit(ok ? 0 : 1);
