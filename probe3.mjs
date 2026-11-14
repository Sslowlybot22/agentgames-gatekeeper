// Oracle probe: a name is a valid circuit input iff calculateWitness({name:0}) does not throw.
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
  "decision_valid", "valid_decision", "checks", "fields",
];

const wc = await WitnessCalculatorBuilder(fs.readFileSync(wasmPath));
const good = [];
for (const name of bases) {
  try {
    await wc.calculateWitness({ [name]: 0 }, false);
    good.push(name);
  } catch (e) {
    if (!/is not an input/.test(e.message)) console.log("other err", name, e.message.slice(0, 80));
  }
}
console.log("valid inputs:", JSON.stringify(good));

// baseline witness with no inputs
const w = await wc.calculateWitness({}, false);
console.log("witness length", w.length, "first 15", w.slice(0, 15).map(String));
