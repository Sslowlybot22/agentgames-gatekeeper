// Fast oracle: setInputSignal throws for names that are not circuit inputs.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { WitnessCalculatorBuilder } = require("circom_runtime");
const { fnvHash } = await import("./node_modules/circom_runtime/js/utils.js");

const wc = await WitnessCalculatorBuilder(
  fs.readFileSync(path.join(process.env.HOME, "agentgames/agent/circuits/gatekeeper.wasm"))
);
const ex = wc.instance.exports;
const SHARED = ex.getSharedRWMemoryStart();
const nWords = ex.getFieldNumLen32();
ex.init(0);
for (let i = 0; i < nWords; i++) ex.writeSharedRWMemory(i, 0);

function isInput(name) {
  const h = fnvHash(name);
  try {
    ex.setInputSignal(parseInt(h.slice(0, 8), 16), parseInt(h.slice(8, 16), 16), 0, SHARED);
    return true;
  } catch {
    return false;
  }
}

// sanity
console.log("known minimum:", isInput("minimum"), "| bogus:", isInput("zzzzNotASignal"));

const P = ["proof", "proofTx", "tx", "ref", "reference", "seen", "used", "reuse", "reused",
  "consumed", "spent", "prior", "prev", "previous", "duplicate", "dup", "accepted",
  "recorded", "known", "already", "first", "fresh", "unique", "new", "old"];
const S = ["", "Seen", "Used", "Reused", "Ref", "Reference", "Tx", "Hash", "Flag", "Set",
  "Count", "Marker", "Known", "Valid", "Ok", "Present", "Before", "Exists", "Index", "Id",
  "Key", "Value", "Number", "Bit", "Bool", "Status", "State"];

const hits = [];
for (const p of P) {
  for (const s of S) {
    const n = p + s;
    if (isInput(n)) hits.push(n);
  }
}
console.log("hits:", JSON.stringify(hits));
