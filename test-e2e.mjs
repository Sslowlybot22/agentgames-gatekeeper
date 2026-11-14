// End-to-end test: sign a task like the platform would, assert the decision + response signature.
import crypto from "node:crypto";

const URL = process.env.URL || "http://127.0.0.1:8792/agent";
const SECRET = process.env.SECRET || "test-secret-abc";

function sign(body) {
  return crypto.createHmac("sha256", SECRET).update(body).digest("hex");
}

const cases = [
  ["valid", {
    registered_vk: "0xaaa", proof_vk: "0xaaa", minimum: "1000", public_balance: "1460",
    expiry_block: 1000, current_block: 900, recipient: "0xDE42", condition_recipient: "0xde42",
    amount: "500", max_transfer: "1000", proof_tx: "0xfresh1",
  }, "APPROVE", "VALID_CONDITION"],
  ["vk substitution", {
    registered_vk: "0xaaa", proof_vk: "0xbbb", minimum: "1000", public_balance: "1460",
    expiry_block: 1000, current_block: 900, recipient: "0xDE42", condition_recipient: "0xDE42",
    amount: "500", max_transfer: "1000", proof_tx: "0xfresh2",
  }, "REJECT", "VK_SUBSTITUTION"],
  ["threshold", {
    registered_vk: "0xaaa", proof_vk: "0xaaa", minimum: "2500", public_balance: "1840",
    expiry_block: 1000, current_block: 900, recipient: "0xDE42", condition_recipient: "0xDE42",
    amount: "500", max_transfer: "1000", proof_tx: "0xfresh3",
  }, "REJECT", "THRESHOLD_MISMATCH"],
  ["reuse", {
    registered_vk: "0xaaa", proof_vk: "0xaaa", minimum: "1000", public_balance: "1460",
    expiry_block: 1000, current_block: 900, recipient: "0xDE42", condition_recipient: "0xDE42",
    amount: "500", max_transfer: "1000", proof_tx: "0xfresh1",
  }, "REJECT", "PROOF_REUSED"],
  ["expired", {
    registered_vk: "0xaaa", proof_vk: "0xaaa", minimum: "1000", public_balance: "1460",
    expiry_block: 800, current_block: 900, recipient: "0xDE42", condition_recipient: "0xDE42",
    amount: "500", max_transfer: "1000", proof_tx: "0xfresh4",
  }, "REJECT", "EXPIRED_CONDITION"],
  ["recipient", {
    registered_vk: "0xaaa", proof_vk: "0xaaa", minimum: "1000", public_balance: "1460",
    expiry_block: 1000, current_block: 900, recipient: "0x11af", condition_recipient: "0x9c3b",
    amount: "500", max_transfer: "1000", proof_tx: "0xfresh5",
  }, "REJECT", "RECIPIENT_MISMATCH"],
  ["overflow", {
    registered_vk: "0xaaa", proof_vk: "0xaaa", minimum: "1000", public_balance: "1460",
    expiry_block: 1000, current_block: 900, recipient: "0xDE42", condition_recipient: "0xDE42",
    amount: "1500", max_transfer: "1000", proof_tx: "0xfresh6",
  }, "REJECT", "AMOUNT_OVERFLOW"],
];

let pass = 0;
for (const [name, input, wantDec, wantReason] of cases) {
  const body = JSON.stringify({ type: "agent-games.proof-gatekeeper.v1", task_id: "t_" + name.replace(/ /g, "_"), input });
  const res = await fetch(URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-agent-games-signature": sign(body) },
    body,
  });
  const text = await res.text();
  const json = JSON.parse(text);
  const respSigOk = res.headers.get("x-agent-games-signature") === sign(text);
  const ok = json.decision === wantDec && json.reason_code === wantReason && respSigOk;
  if (ok) pass++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(16)} ${json.decision}/${json.reason_code} respSig=${respSigOk}`);
}
console.log(`${pass}/${cases.length} passed`);
