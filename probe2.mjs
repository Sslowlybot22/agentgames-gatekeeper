// Probe circuit input names using getSignalOffset32 (throws for unknown names).
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
const pOff = wc.instance.exports.alloc ? wc.instance.exports.alloc(4) : 1024;

function probe(name) {
  const h = fnvHash(name);
  try {
    ex.getSignalOffset32(pOff, 0, parseInt(h.slice(0, 8), 16), parseInt(h.slice(8, 16), 16));
    return wc.getInt(pOff);
  } catch {
    return null;
  }
}

const bases = [
  "registered_vk", "proof_vk", "vk", "vk_hash", "vkHash", "registeredVk", "proofVk",
  "minimum", "min", "threshold", "public_balance", "balance", "publicBalance",
  "expiry_block", "expiry", "expiryBlock", "current_block", "block", "currentBlock",
  "recipient", "condition_recipient", "conditionRecipient", "amount", "max_transfer",
  "maxTransfer", "cap", "proof_tx", "proofTx", "proof", "decision", "reason_code",
  "reasonCode", "approved", "valid", "is_valid", "isValid", "ok", "result", "out",
  "output", "reused", "seen", "vk_match", "threshold_ok", "recipient_ok", "expiry_ok",
  "amount_ok", "fresh", "commitment", "nonce", "task_id", "taskId", "mode", "chain_id",
  "chainId", "decision_flag", "decisionFlag", "approve", "reason", "code", "proof_ref",
  "reference", "sig", "signature", "hash", "statement", "action", "value", "limit",
];

const hits = [];
for (const b of bases) {
  for (const v of [b, "main." + b]) {
    const off = probe(v);
    if (off !== null) hits.push([v, off]);
  }
}
console.log(JSON.stringify(hits, null, 1));
console.log("inputSize", ex.getInputSize(), "witness", ex.getWitnessSize());
