import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { WitnessCalculatorBuilder } = require("circom_runtime");
const wc = await WitnessCalculatorBuilder(fs.readFileSync(path.join(process.env.HOME, "agentgames/agent/circuits/gatekeeper.wasm")));
async function accepted(name) {
  try { await wc.calculateWitness({ [name]: 0 }, false); return 13; }
  catch (e) { const m = e.message.match(/Only (\d+) out of 13/); return m ? Number(m[1]) : -1; }
}
const cands = [
 "vkRegistered","vkProof","registeredVK","proofVK","vkReg","vkSubmit","vkExpected","vkCondition",
 "proofRef","proofReference","proofTx","proofHash","proofKey","proofId",
 "seenProof","seenProofs","usedProof","reusedProof","reference","ref",
 "reasonCode","reason","code","decisionCode","approve","approved","isApproved",
 "blockNumber","block","expiry","current","balance","public_balance","publicBalanceWei",
 "recipientMatch","vkMatch","threshold","thresholdOk","expired","valid","isValid","ok",
 "signature","sig","timestamp","issuedAt","deadline","mode","version","protocolVersion",
 "registeredVkHash","proofVkHash","conditionVk","conditionVkHash","vkHashRegistered","vkHashProof",
];
const good=[]; for (const c of cands){ if (await accepted(c)===1) good.push(c); }
console.log(JSON.stringify(good));
