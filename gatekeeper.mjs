// Full gatekeeper proving path, using the circuit's real witness names.
//
// The circuit has 13 inputs: the 12 public ones plus a private `salt` that the
// prover randomises. nPublic is 13 because taskId is public too.
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");

const DIR = path.join(process.env.HOME, "agentgames/agent");
const WASM = path.join(DIR, "circuits/gatekeeper.wasm");
const ZKEY = path.join(DIR, "circuits/gatekeeper_final.zkey");
const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export const WITNESS_NAMES = [
  "registeredVkHash", "proofVkHash", "minimum", "publicBalance",
  "expiryBlock", "currentBlock", "recipient", "conditionRecipient",
  "amount", "maxTransfer", "decision", "taskId",
];

// Order of the 13 public signals, exactly as the platform computes them.
// taskId is the last 36 characters of the task id with dashes stripped, which is
// the trailing UUID. Falls back to the last 32 hex characters if the id is not in
// that shape, so an unexpected id still produces a proof instead of an exception.
function taskIdField(taskId) {
  const id = String(taskId ?? "");
  const tail = id.slice(-36).replaceAll("-", "");
  if (/^[0-9a-fA-F]{1,32}$/.test(tail)) return "0x" + tail;
  const hex = id.replace(/[^0-9a-fA-F]/g, "").slice(-32);
  return hex ? "0x" + hex : "0x0";
}

export function publicInputs(task, decision) {
  const i = task.input;
  return [
    i.registered_vk, i.proof_vk, i.minimum, i.public_balance, i.expiry_block,
    i.current_block, i.recipient, i.condition_recipient, i.amount, i.max_transfer,
    decision === "APPROVE" ? 1 : 0,
    taskIdField(task.task_id),
  ].map((v) => (BigInt(v) % FIELD).toString());
}

export async function prove(task, decision) {
  const values = publicInputs(task, decision);
  const witness = Object.fromEntries(WITNESS_NAMES.map((n, i) => [n, values[i]]));
  witness.salt = (BigInt("0x" + randomBytes(32).toString("hex")) % FIELD).toString();

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(witness, WASM, ZKEY);

  if (publicSignals.length !== 13) throw new Error("unexpected publicSignals length " + publicSignals.length);
  for (let i = 0; i < 12; i++) {
    if (publicSignals[i + 1] !== values[i]) throw new Error(`public signal ${i} mismatch`);
  }
  return { proof, public_signals: publicSignals };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const task = {
    task_id: "gk_test_9d1_12345678-1234-1234-1234-123456789abc",
    input: {
      registered_vk: "0x7d3a00000000000000000000000000000000000000000000000000000000f291",
      proof_vk: "0x7d3a00000000000000000000000000000000000000000000000000000000f291",
      minimum: "1000", public_balance: "1460",
      expiry_block: 19842201, current_block: 19832000,
      recipient: "0xDe420000000000000000000000000000000009f01",
      condition_recipient: "0xDe420000000000000000000000000000000009f01",
      amount: "500", max_transfer: "1000",
    },
  };
  const t0 = Date.now();
  const ev = await prove(task, "APPROVE");
  console.log("prove ms", Date.now() - t0, "signals", ev.public_signals.length);

  const vk = JSON.parse(fs.readFileSync(path.join(DIR, "circuits/vk.json"), "utf8"));
  console.log("verify", await snarkjs.groth16.verify(vk, ev.public_signals, ev.proof));
  console.log("public", ev.public_signals.join(","));
  fs.writeFileSync(path.join(DIR, "circuits/sample-evidence.json"), JSON.stringify(ev, null, 1));
}
