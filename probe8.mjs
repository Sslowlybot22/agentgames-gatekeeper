import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {WitnessCalculatorBuilder}=require("circom_runtime");
const wc=await WitnessCalculatorBuilder(fs.readFileSync(path.join(process.env.HOME,"agentgames/agent/circuits/gatekeeper.wasm")));
async function acc(n){try{await wc.calculateWitness({[n]:0},false);return 13;}catch(e){const m=e.message.match(/Only (\d+) out of 13/);return m?Number(m[1]):-1;}}
const c=["deadlineAt","issuedAt","deadline","deadlineBlock","expiryAt","currentHeight","blockHeight","signatureValid","sigValid","hmacValid","authOk","timestamp","ts","now","time","hour","epoch","finalized","onchainOk","proofValid","proofOk","verified","verificationOk","finalizedOk","included","includedOk","txOk","refOk","seenOk","usedOk","reuse","isReusedFlag","decisionOk","decisionFlag","validDecision","checksPass","allOk","pass","passOk","okFlag","resultOk","isOk","success","succeeded"];
const good=[]; for(const x of c){ if(await acc(x)===1) good.push(x); }
console.log(JSON.stringify(good));
