// Generate ONE note + withdraw proof for the pool demo, and encode everything to
// the byte/JSON format the pool contract needs. Writes /tmp/pool_demo.env with:
//   PROOF_A/B/C, VK_*, VK_IC, PUB, COMMITMENT, ROOT, NULLIFIER_HASH, RECIPIENT_FIELD
// Use the same note across deposit -> push_root -> withdraw.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';

const here = dirname(fileURLToPath(import.meta.url));
const build = resolve(here, '../build');
const LEVELS = 20;
const R = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

const be32 = (v) => BigInt(v).toString(16).padStart(64, '0');
const g1 = (p) => be32(p[0]) + be32(p[1]);
const g2 = (p) => be32(p[0][1]) + be32(p[0][0]) + be32(p[1][1]) + be32(p[1][0]);

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

// Deterministic when SECRET/NULLIFIER are set (used to freeze test fixtures).
const nullifier = process.env.NULLIFIER ? BigInt(process.env.NULLIFIER) % R : randField();
const secret = process.env.SECRET ? BigInt(process.env.SECRET) % R : randField();
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

// recipient field = sha256(strkey) with the top byte zeroed (248-bit, < r).
// MUST match the contract's recipient_field_of(Address).
const publisher = process.env.PUBLISHER;
if (!publisher) throw new Error('set PUBLISHER=G... (the recipient strkey)');
const digest = createHash('sha256').update(Buffer.from(publisher, 'ascii')).digest();
digest[0] = 0;
const recipient = BigInt('0x' + digest.toString('hex'));

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

const lines = [
  `PROOF_A=${g1(proof.pi_a)}`,
  `PROOF_B=${g2(proof.pi_b)}`,
  `PROOF_C=${g1(proof.pi_c)}`,
  `VK_ALPHA=${g1(vk.vk_alpha_1)}`,
  `VK_BETA=${g2(vk.vk_beta_2)}`,
  `VK_GAMMA=${g2(vk.vk_gamma_2)}`,
  `VK_DELTA=${g2(vk.vk_delta_2)}`,
  `VK_IC=[${vk.IC.map((p) => `"${g1(p)}"`).join(',')}]`,
  `COMMITMENT=${be32(commitment)}`,
  `ROOT=${be32(root)}`,
  `NULLIFIER_HASH=${be32(nullifierHash)}`,
  `RECIPIENT_FIELD=${be32(recipient)}`,
];
writeFileSync('/tmp/pool_demo.env', lines.join('\n') + '\n');
console.log('wrote /tmp/pool_demo.env');
console.log('commitment:', be32(commitment));
console.log('root      :', be32(root));
