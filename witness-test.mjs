// Build a witness with the 12 known inputs; the 13th stays 0.
// getInputSize is overridden so the runtime's completeness check passes.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { WitnessCalculatorBuilder } = require("circom_runtime");

const wc = await WitnessCalculatorBuilder(
  fs.readFileSync(path.join(process.env.HOME, "agentgames/agent/circuits/gatekeeper.wasm"))
);
wc.instance.exports.getInputSize = () => 12;

const base = {
  taskId: 1n,
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

const cases = [
  ["all valid, decision=1", base],
  ["vk mismatch, decision=1", { ...base, proofVkHash: 0xaaaan }],
  ["vk mismatch, decision=0", { ...base, proofVkHash: 0xaaaan, decision: 0n }],
  ["threshold fail, decision=1", { ...base, publicBalance: 500n }],
  ["threshold fail, decision=0", { ...base, publicBalance: 500n, decision: 0n }],
];

for (const [name, input] of cases) {
  try {
    const w = await wc.calculateWitness(input, true);
    console.log("OK  ", name, "witness", w.length, "public[1..13]", w.slice(1, 14).map(String).join(","));
  } catch (e) {
    console.log("FAIL", name, e.message.slice(0, 120));
  }
}
