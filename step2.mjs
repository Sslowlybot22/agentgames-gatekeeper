import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const snarkjs=require("snarkjs");
console.log("start prove");
const t0=Date.now();
const r=await snarkjs.groth16.prove("circuits/gatekeeper_final.zkey","circuits/step1.wtns");
console.log("prove ms",Date.now()-t0);
console.log("signals",r.publicSignals.length);
