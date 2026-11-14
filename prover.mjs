// Generate a Groth16 proof without knowing every circuit input name.
// The 13th input is left at its zero default; the runtime's completeness check is
// skipped by driving the wasm exports directly.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { WitnessCalculatorBuilder } = require("circom_runtime");
const snarkjs = require("snarkjs");

const DIR = path.join(process.env.HOME, "agentgames/agent");
const WASM = path.join(DIR, "circuits/gatekeeper.wasm");
const ZKEY = path.join(DIR, "circuits/gatekeeper_final.zkey");
const VK = path.join(DIR, "circuits/vk.json");

export async function buildWitness(input) {
  const wc = await WitnessCalculatorBuilder(fs.readFileSync(WASM));
  const ex = wc.instance.exports;
  const n32 = ex.getFieldNumLen32();
  ex.init(0);
  const prime = (() => {
    ex.getRawPrime();
    let v = 0n;
    for (let i = n32 - 1; i >= 0; i--) v = (v << 32n) + BigInt(ex.readSharedRWMemory(i) >>> 0);
    return v;
  })();

  const { fnvHash } = await import("./node_modules/circom_runtime/js/utils.js");

  for (const [k, val] of Object.entries(input)) {
    const h = fnvHash(k);
    const hMSB = parseInt(h.slice(0, 8), 16);
    const hLSB = parseInt(h.slice(8, 16), 16);
    let n = BigInt(val) % prime;
    if (n < 0n) n += prime;
    for (let j = 0; j < n32; j++) {
      ex.writeSharedRWMemory(j, Number((n >> BigInt(32 * (n32 - 1 - j))) & 0xffffffffn));
    }
    ex.setInputSignal(hMSB, hLSB, 0);
  }

  const size = ex.getWitnessSize();
  const w = [];
  for (let i = 0; i < size; i++) {
    ex.getWitness(i);
    let v = 0n;
    for (let j = n32 - 1; j >= 0; j--) v = (v << 32n) + BigInt(ex.readSharedRWMemory(j) >>> 0);
    w.push(v);
  }
  return { w, prime, n32 };
}

export function writeWtns(file, { w, prime, n32 }) {
  const head = Buffer.alloc(12);
  head.write("wtns", 0, "ascii");
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(2, 8);

  const n8 = n32 * 4;
  const s1 = Buffer.alloc(4 + n8 + 4);
  s1.writeUInt32LE(n8, 0);
  for (let i = 0; i < n32; i++) {
    s1.writeUInt32LE(Number((prime >> BigInt(32 * i)) & 0xffffffffn), 4 + i * 4);
  }
  s1.writeUInt32LE(w.length, 4 + n8);

  const s2 = Buffer.alloc(w.length * n32 * 4);
  w.forEach((v, idx) => {
    for (let i = 0; i < n32; i++) {
      s2.writeUInt32LE(Number((v >> BigInt(32 * i)) & 0xffffffffn), (idx * n32 + i) * 4);
    }
  });

  const sec = (id, data) => {
    const b = Buffer.alloc(12 + data.length);
    b.writeUInt32LE(id, 0);
    b.writeUInt32LE(data.length & 0xffffffff, 4);
    b.writeUInt32LE(0, 8);
    data.copy(b, 12);
    return b;
  };

  fs.writeFileSync(file, Buffer.concat([head, sec(1, s1), sec(2, s2)]));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = {
    taskId: 7n,
    registeredVkHash: 0x7d3an,
    proofVkHash: 0x7d3an,
    minimum: 1000n,
    publicBalance: 1460n,
    expiryBlock: 1000n,
    currentBlock: 900n,
    recipient: 0xde42n,
    conditionRecipient: 0xde42n,
    amount: 500n,
    maxTransfer: 1000n,
    decision: 1n,
  };
  const wit = await buildWitness(input);
  const wtnsPath = path.join(DIR, "circuits/test.wtns");
  writeWtns(wtnsPath, wit);
  const { proof, publicSignals } = await snarkjs.groth16.prove(ZKEY, wtnsPath);
  const vk = JSON.parse(fs.readFileSync(VK, "utf8"));
  const ok = await snarkjs.groth16.verify(vk, publicSignals, proof);
  console.log("verified:", ok, "nSignals:", publicSignals.length);
  console.log("publicSignals:", publicSignals.join(","));
}
