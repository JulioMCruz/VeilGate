// VeilGate -- generate a REAL UltraHonk proof from the Noir paywall circuit.
//
// This is the Noir-native proving path (the same one the browser uses via
// @aztec/bb.js). It replaces the placeholder/SHA-256 stand-in in app/lib/proof.ts
// with a genuine, self-verifying UltraHonk proof.
//
// Prereqs (pinned to nargo 1.0.0-beta.9):
//   cd scripts && npm install            # installs noir_js + bb.js
//   cd ../circuits && nargo compile      # produces target/zk_paywall.json
//
// Run:
//   cd scripts && node prove_ultrahonk.mjs
//
// On success it prints PASS and writes out/proof.bin + out/public_inputs.json.
//
// Note: the on-chain UltraHonk *verifier* contract (Soroban) is a separate,
// heavier component -- see circuits/README.md "On-chain verification".

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';

const here = dirname(fileURLToPath(import.meta.url));
const circuitPath = resolve(here, '../circuits/target/zk_paywall.json');
const circuit = JSON.parse(readFileSync(circuitPath, 'utf8'));

// Canonical valid witness -- mirrors circuits/Prover.toml and the circuit test
// `test_valid_payment_proof_succeeds`. The public hashes come from the circuit's
// own Pedersen helpers (dumped via `nargo test print_valid_witness`).
const zeros20 = Array.from({ length: 20 }, () => '0x0');
const idx20 = Array.from({ length: 20 }, () => '0');
const inputs = {
  commitment: '0x18701ce0a78aff02bf2b73959260d84aae16f87d336c96a967627a8269b4e707',
  nullifier_hash: '0x231369b7748afd529207ce7cab8686c85cf1d106a2b21bc0fa783711c55450bc',
  publisher_pubkey_x: '0xdead',
  publisher_pubkey_y: '0xbeef',
  merkle_root: '0x0b42bb1d3eb2bcd24f6cebed16dee42a8e2decc684e03021967f35594fec9e28',
  amount_range_bit: '1',
  secret: '0x1234',
  nullifier: '0xabcd',
  amount: '100',
  merkle_path: zeros20,
  merkle_indices: idx20,
};

console.log('1) executing circuit -> witness');
const noir = new Noir(circuit);
const { witness } = await noir.execute(inputs);
console.log(`   witness solved (${witness.length} elements)`);

console.log('2) generating UltraHonk proof (bb.js)');
const backend = new UltraHonkBackend(circuit.bytecode);
const t0 = Date.now();
const proof = await backend.generateProof(witness);
console.log(
  `   proof: ${proof.proof.length} bytes | ${proof.publicInputs.length} public inputs | ${Date.now() - t0} ms`,
);

console.log('3) verifying the proof (bb.js)');
const ok = await backend.verifyProof(proof);
console.log('   VERIFIED:', ok);

console.log('4) tamper check: corrupt a public input -> must fail');
const tampered = { proof: proof.proof, publicInputs: [...proof.publicInputs] };
const pi0 = tampered.publicInputs[0];
tampered.publicInputs[0] = pi0.slice(0, -1) + (pi0.endsWith('0') ? '1' : '0');
let tamperedOk;
try {
  tamperedOk = await backend.verifyProof(tampered);
} catch {
  tamperedOk = false;
}
console.log('   tampered verifies (must be false):', tamperedOk);

const outDir = resolve(here, 'out');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'proof.bin'), Buffer.from(proof.proof));
writeFileSync(resolve(outDir, 'public_inputs.json'), JSON.stringify(proof.publicInputs, null, 2));

await backend.destroy?.();
const pass = ok && !tamperedOk;
console.log(`\nRESULT: ${pass ? 'PASS (real UltraHonk proof verifies, tampered rejected)' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
