// Generate a withdraw proof and encode it (+ the VK) to the byte format the
// VeilGate BN254 Soroban verifier expects:
//   G1 = be(X)||be(Y) (64B);  G2 = be(X.c1)||be(X.c0)||be(Y.c1)||be(Y.c0) (128B);
//   Fr = be(value) (32B).
// Writes /tmp/pool_invoke.env with hex values for `stellar contract invoke`.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';

const here = dirname(fileURLToPath(import.meta.url));
const build = resolve(here, '../build');
const LEVELS = 20;
const R = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

const be32 = (v) => BigInt(v).toString(16).padStart(64, '0');
const g1 = (p) => be32(p[0]) + be32(p[1]);                                   // 64B
const g2 = (p) => be32(p[0][1]) + be32(p[0][0]) + be32(p[1][1]) + be32(p[1][0]); // 128B, c1 first

function randField() {
  const a = new Uint8Array(31);
  crypto.getRandomValues(a);
  let n = 0n;
  for (const b of a) n = (n << 8n) | BigInt(b);
  return n % R;
}

const poseidon = await buildPoseidon();
const F = poseidon.F;
const H2 = (a, b) => F.toObject(poseidon([a, b]));
const H1 = (a) => F.toObject(poseidon([a]));

const nullifier = randField();
const secret = randField();
const commitment = H2(nullifier, secret);
const nullifierHash = H1(nullifier);
const zeros = [0n];
for (let i = 1; i < LEVELS; i++) zeros.push(H2(zeros[i - 1], zeros[i - 1]));
const pathElements = [];
const pathIndices = [];
let cur = commitment;
for (let i = 0; i < LEVELS; i++) {
  pathElements.push(zeros[i].toString());
  pathIndices.push(0);
  cur = H2(cur, zeros[i]);
}
const root = cur;
const recipient = 0x5075626c6973686572n % R;

const input = {
  root: root.toString(),
  nullifierHash: nullifierHash.toString(),
  recipient: recipient.toString(),
  nullifier: nullifier.toString(),
  secret: secret.toString(),
  pathElements,
  pathIndices,
};

const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  input,
  resolve(build, 'withdraw_js/withdraw.wasm'),
  resolve(build, 'withdraw_final.zkey')
);
const vk = JSON.parse(readFileSync(resolve(build, 'verification_key.json'), 'utf8'));
console.log('snarkjs verify:', await snarkjs.groth16.verify(vk, publicSignals, proof));
console.log('nPublic:', publicSignals.length, ' IC len:', vk.IC.length);

const lines = [
  `PROOF_A=${g1(proof.pi_a)}`,
  `PROOF_B=${g2(proof.pi_b)}`,
  `PROOF_C=${g1(proof.pi_c)}`,
  `VK_ALPHA=${g1(vk.vk_alpha_1)}`,
  `VK_BETA=${g2(vk.vk_beta_2)}`,
  `VK_GAMMA=${g2(vk.vk_gamma_2)}`,
  `VK_DELTA=${g2(vk.vk_delta_2)}`,
  `VK_IC=[${vk.IC.map((p) => `"${g1(p)}"`).join(',')}]`,
  `PUB=[${publicSignals.map((s) => `"${be32(s)}"`).join(',')}]`,
];
writeFileSync('/tmp/pool_invoke.env', lines.join('\n') + '\n');
console.log('wrote /tmp/pool_invoke.env  (', vk.IC.length, 'IC,', publicSignals.length, 'public inputs )');
