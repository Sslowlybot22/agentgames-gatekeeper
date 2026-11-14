import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {WitnessCalculatorBuilder}=require("circom_runtime");
const wc=await WitnessCalculatorBuilder(fs.readFileSync(path.join(process.env.HOME,"agentgames/agent/circuits/gatekeeper.wasm")));
async function acc(n){try{await wc.calculateWitness({[n]:0},false);return 13;}catch(e){const m=e.message.match(/Only (\d+) out of 13/);return m?Number(m[1]):-1;}}
const c=["proofTxRef","proofTxReference","proofTxCommitment","proofTxKey","proofTxLeaf","proofTxIndex","proofTxNonce","proofTxId","proofTxValue","proofTxNumber","proofTxHashSeen","proofTxSeenBefore","proofTxUsedBefore","txReference","txCommitment","txNonce","txIndex","txLeaf","txId","txKey","proofReferenceHash","proofRefHash","referenceHash","refHash","seenHash","usedHash","proofHashSeen","proofCommitment","proofLeaf","proofIndex","proofNonce","proofNumber","proofValue"];
const good=[]; for(const x of c){ if(await acc(x)===1) good.push(x); }
console.log(JSON.stringify(good));
