// Oracle: circom2 witness calculator reports how many inputs were accepted.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { WitnessCalculatorBuilder } = require("circom_runtime");

const wasmPath = path.join(process.env.HOME, "agentgames/agent/circuits/gatekeeper.wasm");

const bases = [
  "registered_vk", "proof_vk", "vk", "vk_hash", "vkHash", "registeredVk", "proofVk",
  "minimum", "min", "threshold", "public_balance", "balance", "publicBalance",
  "expiry_block", "expiry", "expiryBlock", "current_block", "block", "currentBlock",
  "recipient", "condition_recipient", "conditionRecipient", "amount", "max_transfer",
  "maxTransfer", "cap", "proof_tx", "proofTx", "proof", "decision", "reason_code",
  "reasonCode", "approved", "valid", "is_valid", "isValid", "ok", "result", "out",
  "output", "reused", "seen", "vk_match", "threshold_ok", "recipient_ok", "expiry_ok",
  "amount_ok", "fresh", "commitment", "nonce", "task_id", "taskId", "mode", "chain_id",
  "chainId", "approve", "reason", "code", "proof_ref", "reference", "hash", "statement",
  "action", "value", "limit", "min_amount", "max_amount", "required", "is_approved",
  "decision_valid", "valid_decision", "checks", "fields", "in", "input", "signals",
];

const wc = await WitnessCalculatorBuilder(fs.readFileSync(wasmPath));

async function accepted(name) {
  try {
    await wc.calculateWitness({ [name]: 0 }, false);
    return 13;
  } catch (e) {
    const m = e.message.match(/Only (\d+) out of 13/);
    return m ? Number(m[1]) : -1;
  }
}

const good = [];
for (const n of bases) {
  const c = await accepted(n);
  if (c === 1) good.push(n);
  else if (c !== 0) console.log("odd", n, c);
}
console.log("valid:", JSON.stringify(good));
