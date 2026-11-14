// Map circuit input signal indices by offset, then build witnesses without knowing every name.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { WitnessCalculatorBuilder } = require("circom_runtime");
const { fnvHash } = await import("./node_modules/circom_runtime/js/utils.js");

const wc = await WitnessCalculatorBuilder(
  fs.readFileSync(path.join(process.env.HOME, "agentgames/agent/circuits/gatekeeper.wasm"))
);

const KNOWN = [
  "minimum", "publicBalance", "expiryBlock", "currentBlock", "recipient",
  "conditionRecipient", "amount", "maxTransfer", "decision", "taskId",
  "registeredVkHash", "proofVkHash",
];

// allocate a scratch int in wasm memory using the module's own allocator if exposed
const ex = wc.instance.exports;
const mem = wc.instance.exports.memory;
console.log("exports:", Object.keys(ex).join(","));
