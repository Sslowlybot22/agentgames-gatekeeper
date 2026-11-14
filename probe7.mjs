import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {WitnessCalculatorBuilder}=require("circom_runtime");
const wc=await WitnessCalculatorBuilder(fs.readFileSync(path.join(process.env.HOME,"agentgames/agent/circuits/gatekeeper.wasm")));
async function acc(n){try{await wc.calculateWitness({[n]:0},false);return 13;}catch(e){const m=e.message.match(/Only (\d+) out of 13/);return m?Number(m[1]):-1;}}
const c=["txRef","txHash","txSeen","transactionRef","transactionHash","proofTransaction","proofTransactionHash","proofTxSeen","proofTxUsed","proofTxHash","proofRefUsed","refSeen","referenceSeen","refUsed","referenceUsed","seenRef","seenReference","usedRef","usedReference","consumed","consumedRef","proofConsumed","isReused","reusedFlag","reuseFlag","seenFlag","usedFlag","previouslySeen","alreadySeen","alreadyUsed","proofAlreadyUsed","duplicate","duplicateProof","proofDuplicate","unique","isUnique","isFresh","fresh","firstSeen","proofReferenceSeen","referenceUsedBefore","seenBefore","usedBefore","prevSeen","priorSeen","alreadyAccepted","accepted","acceptedRef","proofAccepted"];
const good=[]; for(const x of c){ if(await acc(x)===1) good.push(x); }
console.log(JSON.stringify(good));
