// Generate a real Groth16 proof for the withdraw circuit and verify it.
// Builds a note, inserts it as leaf 0 of an empty depth-20 Poseidon tree, and
// proves membership + nullifier + recipient binding.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';

const here = dirname(fileURLToPath(import.meta.url));
const build = resolve(here, '../build');

const LEVELS = 20;
const R = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

function randField() {
  const a = new Uint8Array(31); // < r
  crypto.getRandomValues(a);
  let n = 0n;
  for (const b of a) n = (n << 8n) | BigInt(b);
  return n % R;
}

const poseidon = await buildPoseidon();
const F = poseidon.F;
const H2 = (a, b) => F.toObject(poseidon([a, b]));
const H1 = (a) => F.toObject(poseidon([a]));

// ---- build a note ----
const nullifier = randField();
const secret = randField();
const commitment = H2(nullifier, secret);
const nullifierHash = H1(nullifier);

// ---- empty tree, leaf at index 0 ----
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

// publisher address, encoded as a field (demo value)
const recipient = 0x5075626c6973686572n % R; // "Publisher"

const input = {
  root: root.toString(),
  nullifierHash: nullifierHash.toString(),
  recipient: recipient.toString(),
  nullifier: nullifier.toString(),
  secret: secret.toString(),
  pathElements,
  pathIndices,
};

console.log('commitment  :', commitment.toString());
console.log('nullifierH  :', nullifierHash.toString());
console.log('root        :', root.toString());

console.log('generating Groth16 proof…');
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  input,
  resolve(build, 'withdraw_js/withdraw.wasm'),
  resolve(build, 'withdraw_final.zkey')
);

const vk = JSON.parse(readFileSync(resolve(build, 'verification_key.json'), 'utf8'));
const ok = await snarkjs.groth16.verify(vk, publicSignals, proof);
console.log('public signals:', publicSignals);
console.log('VERIFIED:', ok);

// negative: tamper a public signal (wrong recipient) -> must fail
const tampered = [...publicSignals];
tampered[2] = (BigInt(tampered[2]) + 1n).toString();
const bad = await snarkjs.groth16.verify(vk, tampered, proof);
console.log('tampered verifies (must be false):', bad);

process.exit(ok && !bad ? 0 : 1);
