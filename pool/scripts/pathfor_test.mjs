// Integration test for the app's tree reconstruction (app/lib/pool.ts `pathFor`).
// Rebuilds the commitment tree off-chain for several leaf positions, generates a
// real withdraw proof for each, and checks snarkjs verifies it — proving the
// browser path reconstruction yields circuit-valid proofs at any index.
//
//   node scripts/pathfor_test.mjs   (exit 0 = pass)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';

const here = dirname(fileURLToPath(import.meta.url));
const build = resolve(here, '../build');
const LEVELS = 20;
const R = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

// circomlibjs poseidon — identical to the app's poseidon-lite (validated).
const _p = await buildPoseidon();
const _F = _p.F;
const poseidon1 = (a) => _F.toObject(_p([a[0]]));
const poseidon2 = (a) => _F.toObject(_p([a[0], a[1]]));

const rnd = () => {
  const a = new Uint8Array(31);
  crypto.getRandomValues(a);
  let n = 0n;
  for (const b of a) n = (n << 8n) | BigInt(b);
  return n % R;
};

const zeros = [0n];
for (let i = 1; i <= LEVELS; i++) zeros.push(poseidon2([zeros[i - 1], zeros[i - 1]]));

// Mirror of app/lib/pool.ts pathFor().
function pathFor(leaves, index) {
  let cur = leaves.slice();
  let idx = index;
  const pathElements = [];
  const pathIndices = [];
  for (let level = 0; level < LEVELS; level++) {
    const sib = (idx ^ 1) < cur.length ? cur[idx ^ 1] : zeros[level];
    pathElements.push(sib.toString());
    pathIndices.push(idx & 1);
    const next = [];
    for (let i = 0; i < cur.length; i += 2) {
      next.push(poseidon2([cur[i], i + 1 < cur.length ? cur[i + 1] : zeros[level]]));
    }
    cur = next.length ? next : [zeros[level + 1]];
    idx >>= 1;
  }
  return { root: cur[0], pathElements, pathIndices };
}

const wasm = resolve(build, 'withdraw_js/withdraw.wasm');
const zkey = resolve(build, 'withdraw_final.zkey');
const vk = JSON.parse(readFileSync(resolve(build, 'verification_key.json'), 'utf8'));
const recipient = 0x5075626c6973686572n % R;

async function proveAt(nLeaves, index) {
  const notes = Array.from({ length: nLeaves }, () => ({ s: rnd(), n: rnd() }));
  const leaves = notes.map((x) => poseidon2([x.n, x.s]));
  const { root, pathElements, pathIndices } = pathFor(leaves, index);
  const me = notes[index];
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    {
      root: root.toString(),
      nullifierHash: poseidon1([me.n]).toString(),
      recipient: recipient.toString(),
      nullifier: me.n.toString(),
      secret: me.s.toString(),
      pathElements,
      pathIndices,
    },
    wasm,
    zkey
  );
  return snarkjs.groth16.verify(vk, publicSignals, proof);
}

// index 0 (single leaf, all-zero siblings), a right child, and a deeper index.
const cases = [
  [1, 0],
  [2, 1],
  [5, 3],
];
let ok = true;
for (const [n, i] of cases) {
  const pass = await proveAt(n, i);
  console.log(`pathFor(${n} leaves, index ${i}) -> proof verifies: ${pass}`);
  ok = ok && pass;
}
console.log(ok ? 'PATHFOR TEST OK' : 'PATHFOR TEST FAILED');
process.exit(ok ? 0 : 1);
