import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {WitnessCalculatorBuilder}=require("circom_runtime");
const {fnvHash}=await import("./node_modules/circom_runtime/js/utils.js");
const wc=await WitnessCalculatorBuilder(fs.readFileSync(path.join(process.env.HOME,"agentgames/agent/circuits/gatekeeper.wasm")));
const ex=wc.instance.exports;
const names=["minimum","publicBalance","expiryBlock","currentBlock","recipient","conditionRecipient","amount","maxTransfer","decision","taskId","registeredVkHash","proofVkHash"];
let total=0;
for(const n of names){
  const h=fnvHash(n); const s=ex.getInputSignalSize(parseInt(h.slice(0,8),16),parseInt(h.slice(8,16),16));
  total+=s; console.log(n,s);
}
console.log("total",total,"inputSize",ex.getInputSize(),"witness",ex.getWitnessSize());
