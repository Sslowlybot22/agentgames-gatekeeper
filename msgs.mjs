import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {WitnessCalculatorBuilder}=require("circom_runtime");
const wc=await WitnessCalculatorBuilder(fs.readFileSync(path.join(process.env.HOME,"agentgames/agent/circuits/gatekeeper.wasm")));
const ex=wc.instance.exports;
for(let m=0;m<80;m++){
  let s="";
  try{ for(let i=0;i<200;i++){ const c=ex.getMessageChar(m,i); if(!c) break; s+=String.fromCharCode(c);} }catch(e){ break; }
  if(s) console.log(m, JSON.stringify(s).slice(0,160));
}
