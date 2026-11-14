import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {WitnessCalculatorBuilder}=require("circom_runtime");
const {fnvHash}=await import("./node_modules/circom_runtime/js/utils.js");
const wc=await WitnessCalculatorBuilder(fs.readFileSync(path.join(process.env.HOME,"agentgames/agent/circuits/gatekeeper.wasm")));
const ex=wc.instance.exports;
const H=new Map();
function size(n){let h=H.get(n); if(h===undefined){h=fnvHash(n);H.set(n,h);} return ex.getInputSignalSize(parseInt(h.slice(0,8),16),parseInt(h.slice(8,16),16));}
const V=["proof","tx","ref","reference","seen","used","reuse","consumed","spent","prior","prev","previous","duplicate","dup","accepted","recorded","known","already","first","fresh","unique","valid","ok","flag","set","count","marker","present","exists","index","id","key","value","number","bit","bool","status","state","task","vk","hash","decision","block","expiry","current","minimum","amount","balance","recipient","condition","max","transfer","registered","public","deadline","issued","signature","sig","hmac","auth","mode","chain","nonce","expired","expiryOk","check","checks"];
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const hits=[];
for(const a of V){ if(size(a)>0) hits.push(a); }
for(const a of V) for(const b of V){ const n=a+cap(b); if(size(n)>0) hits.push(n); }
console.log("hits",JSON.stringify(hits));
