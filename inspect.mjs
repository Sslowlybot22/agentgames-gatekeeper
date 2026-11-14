// Inspect the gatekeeper circuit: signal names, public count, input shape.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const wcBuilder = require("snarkjs").wtns;
const { WitnessCalculatorBuilder } = require("circom_runtime");

const WASM = path.join(process.env.HOME, "agentgames/agent/circuits/gatekeeper.wasm");
const buf = fs.readFileSync(WASM);

const wc = await WitnessCalculatorBuilder(buf);
console.log("methods:", Object.keys(wc).filter((k) => typeof wc[k] === "function").join(","));

// The wasm exposes circom_* exports; enumerate signal names via the runtime API.
const n = wc.instance.exports.getSignalSize ? wc.instance.exports.getSignalSize() : null;
console.log("signalSize export:", n);
for (const k of Object.keys(wc.instance.exports)) {
  if (/signal|input|size|main/i.test(k)) console.log("export", k, typeof wc.instance.exports[k]);
}
