// Brute-force the gatekeeper circuit's input signal names via fnvHash probing.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { WitnessCalculatorBuilder } = require("circom_runtime");
const { fnvHash } = await import("./node_modules/circom_runtime/js/utils.js");

const WASM = path.join(process.env.HOME, "agentgames/agent/circuits/gatekeeper.wasm");
const wc = await WitnessCalculatorBuilder(fs.readFileSync(WASM));
const { getInputSignalSize } = wc.instance.exports;

function size(name) {
  const h = fnvHash(name);
  return getInputSignalSize(h >> 16, h & 0xffff, 0);
}

const candidates = [
  "registered_vk", "proof_vk", "vk", "vkHash", "vk_hash", "registeredVk", "proofVk",
  "minimum", "min_amount", "minAmount", "threshold", "public_balance", "publicBalance",
  "balance", "expiry_block", "expiryBlock", "expiry", "current_block", "currentBlock",
  "block", "blockNumber", "recipient", "condition_recipient", "conditionRecipient",
  "amount", "max_transfer", "maxTransfer", "cap", "proof_tx", "proofTx", "proof_ref",
  "proofReference", "decision", "reason_code", "reasonCode", "approved", "valid",
  "isValid", "is_valid", "ok", "result", "out", "output", "seen", "reused",
  "vk_match", "threshold_ok", "recipient_ok", "expiry_ok", "amount_ok", "fresh",
  "commitment", "nonce", "task_id", "taskId", "mode",
];

const found = [];
for (const c of candidates) {
  const s = size(c);
  if (s > 0) found.push([c, s]);
}
console.log("found", JSON.stringify(found));

// also probe nested field names used by circom inputs: main.xxx
const found2 = [];
for (const c of candidates) {
  for (const prefix of ["main.", "main_"]) {
    const s = size(prefix + c);
    if (s > 0) found2.push([prefix + c, s]);
  }
}
console.log("prefixed", JSON.stringify(found2));
console.log("inputSize", wc.instance.exports.getInputSize(), "witnessSize", wc.instance.exports.getWitnessSize());
