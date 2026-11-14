import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { WitnessCalculatorBuilder } = require("circom_runtime");
const wc = await WitnessCalculatorBuilder(fs.readFileSync(path.join(process.env.HOME, "agentgames/agent/circuits/gatekeeper.wasm")));
async function acc(n){try{await wc.calculateWitness({[n]:0},false);return 13;}catch(e){const m=e.message.match(/Only (\d+) out of 13/);return m?Number(m[1]):-1;}}
const A=["proof","vk","reference","ref","task","tx","hash","seen","used","reused","reuse","spent","consumed","previous","prior","dup","duplicate"];
const B=["","Id","Key","Hash","Ref","Reference","Seen","Used","Flag","Marker","Set","SeenBefore","AlreadyUsed","Count"];
const cands=new Set();
for(const a of A) for(const b of B) cands.add(a+b);
const good=[]; for(const c of [...cands]){ if(await acc(c)===1) good.push(c); }
console.log(JSON.stringify(good));
