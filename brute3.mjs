import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {WitnessCalculatorBuilder}=require("circom_runtime");
const {fnvHash}=await import("./node_modules/circom_runtime/js/utils.js");
const wc=await WitnessCalculatorBuilder(fs.readFileSync(path.join(process.env.HOME,"agentgames/agent/circuits/gatekeeper.wasm")));
const ex=wc.instance.exports;
function size(n){const h=fnvHash(n);return ex.getInputSignalSize(parseInt(h.slice(0,8),16),parseInt(h.slice(8,16),16));}
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const V=["proof","tx","ref","reference","seen","used","reuse","registered","expected","condition","actual","task","vk","hash","key","id","commitment","leaf","nonce","index","flag","set","count","marker","first","already","prior","prev","duplicate","accepted","consumed","spent","public","recipient","amount","minimum","balance","block","expiry","current","max","transfer","decision","deadline","issued","signature","sig","hmac","auth","mode","chain","status","state","value","number","valid","ok"];
const hits=[];
outer: for(const a of V) for(const b of V) for(const c of V){ const n=a+cap(b)+cap(c); if(size(n)>0) hits.push(n); }
console.log("hits",JSON.stringify(hits));
