import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {WitnessCalculatorBuilder}=require("circom_runtime");
const {fnvHash}=await import("./node_modules/circom_runtime/js/utils.js");
const wc=await WitnessCalculatorBuilder(fs.readFileSync(path.join(process.env.HOME,"agentgames/agent/circuits/gatekeeper.wasm")));
const ex=wc.instance.exports;
function size(n){const h=fnvHash(n);return ex.getInputSignalSize(parseInt(h.slice(0,8),16),parseInt(h.slice(8,16),16));}
const c=["nullifier","proofNullifier","txNullifier","nullifierHash","refNullifier","proofTxNullifier","nullifierSeen","nullifierUsed","spentNullifier","commitmentNullifier","proofCommitment","txCommitment","commitmentSeen","proofRoot","merkleRoot","root","seenRoot","proofIndexSeen","proofLeafSeen","leafSeen","proofTxIndexSeen","onchainRef","onchainProofRef","finalizedRef","verifiedRef","proofFinalized","finalizedBefore","includedBefore","proofIncluded","proofSubmitted","proofSubmittedBefore","submittedBefore","firstSubmission","submissionCount","timesSubmitted","timesSeen","timesUsed","occurrences","duplicateCount","reuseCount","proofCount","txCount","refCount"];
const hits=[]; for(const x of c){ if(size(x)>0) hits.push(x); }
console.log(JSON.stringify(hits));
