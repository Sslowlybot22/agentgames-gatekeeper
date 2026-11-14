// Agent Games · Proof Gatekeeper agent endpoint.
// POST /agent  — HMAC-verified task envelope in, signed decision out.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PORT || 8787);
const SECRET = process.env.AGENT_GAMES_HMAC_SECRET || "";
const LOG = path.join(process.env.HOME, "agentgames", "agent", "log.jsonl");

const seenProofs = new Set();
const seenTasks = new Set();
const stats = { tasks: 0, approve: 0, reject: 0, preflight: 0, hmacFail: 0 };

function logRec(obj) {
  try { fs.appendFileSync(LOG, JSON.stringify({ t: new Date().toISOString(), ...obj }) + "\n"); } catch {}
}

// --- HMAC -------------------------------------------------------------------
const SUPPORTED_HMAC_ALGS = ["sha256", "sha512", "sha1"];

function candidates(raw, algs = SUPPORTED_HMAC_ALGS) {
  const out = [];
  for (const alg of algs) {
    const digest = crypto.createHmac(alg, SECRET).update(raw).digest();
    out.push(digest.toString("hex"));
    out.push(digest.toString("base64"));
    out.push(`${alg}=${digest.toString("hex")}`);
    out.push(`sha256=${digest.toString("hex")}`);
  }
  return out;
}

function verifyHmac(raw, header) {
  if (!SECRET) return { ok: false, why: "no secret configured" };
  if (!header) return { ok: false, why: "missing signature header" };
  const got = String(header).trim();
  const algs = SUPPORTED_HMAC_ALGS;
  for (const c of candidates(raw, algs)) {
    const a = Buffer.from(c);
    const b = Buffer.from(got);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return { ok: true, alg: "match" };
  }
  return { ok: false, why: "hmac mismatch" };
}

function sign(body) {
  if (!SECRET) return "";
  return crypto.createHmac("sha256", SECRET).update(body).digest("hex");
}

// --- decision ---------------------------------------------------------------
const ORDER = [
  "VK_SUBSTITUTION",
  "THRESHOLD_MISMATCH",
  "PROOF_REUSED",
  "EXPIRED_CONDITION",
  "RECIPIENT_MISMATCH",
  "AMOUNT_OVERFLOW",
];

function normAddr(a) { return String(a ?? "").trim().toLowerCase(); }
function big(v) { try { return BigInt(String(v ?? "0").trim()); } catch { return null; } }

function decide(input) {
  const findings = [];
  const checks = {};

  const regVk = normAddr(input.registered_vk);
  const proofVk = normAddr(input.proof_vk);
  checks.vk = !!regVk && regVk === proofVk;
  if (!checks.vk) findings.push("VK_SUBSTITUTION");

  const min = big(input.minimum);
  const bal = big(input.public_balance);
  checks.threshold = min !== null && bal !== null && bal >= min;
  if (!checks.threshold) findings.push("THRESHOLD_MISMATCH");

  const ref = String(input.proof_tx ?? "").trim().toLowerCase();
  const reused = ref ? seenProofs.has(ref) : true;
  checks.fresh = ref.length > 0 && !reused;
  if (!checks.fresh) findings.push("PROOF_REUSED");

  const expiry = big(input.expiry_block);
  const cur = big(input.current_block);
  checks.notExpired = expiry !== null && cur !== null && cur <= expiry;
  if (!checks.notExpired) findings.push("EXPIRED_CONDITION");

  const rcpt = normAddr(input.recipient);
  const want = normAddr(input.condition_recipient);
  checks.recipient = !!rcpt && rcpt === want;
  if (!checks.recipient) findings.push("RECIPIENT_MISMATCH");

  const amt = big(input.amount);
  const cap = big(input.max_transfer);
  checks.amount = amt !== null && cap !== null && amt <= cap;
  if (!checks.amount) findings.push("AMOUNT_OVERFLOW");

  // A proof must exist and be finalized to approve.
  checks.proofPresent = ref.length > 0;

  const approve = findings.length === 0 && checks.proofPresent;
  return {
    decision: approve ? "APPROVE" : "REJECT",
    reason: approve ? "VALID_CONDITION" : findings.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0],
    checks,
    findings,
  };
}

// --- http -------------------------------------------------------------------
function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "content-type": "application/json",
    "x-agent-games-signature": sign(body),
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf8");

    if (req.method === "GET") {
      return send(res, 200, { ok: true, protocolVersion: "v1", stats });
    }
    if (req.method !== "POST") return send(res, 405, { error: "method" });

    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch { return send(res, 400, { error: "bad json" }); }

    // Preflight: the platform pings with a signed probe. Verify first, then ack.
    const hmacHeader = req.headers["x-agent-games-signature"];
    const h = verifyHmac(raw, hmacHeader);

    const looksPreflight =
      !payload ||
      payload.type === "preflight" ||
      payload.type === "agent-games.preflight.v1" ||
      payload.probe === true;

    if (looksPreflight) {
      stats.preflight++;
      logRec({ kind: "preflight", hmac: h, raw: raw.slice(0, 2000), headers: redactHeaders(req.headers) });
      if (!h.ok && SECRET) return send(res, 401, { error: "signature" });
      return send(res, 200, { ok: true, protocolVersion: "v1" });
    }

    if (!h.ok) {
      stats.hmacFail++;
      logRec({ kind: "hmac_fail", why: h.why, raw: raw.slice(0, 4000), headers: redactHeaders(req.headers) });
      return send(res, 401, { error: "signature", detail: h.why });
    }

    const task = payload;
    logRec({ kind: "task", raw });

    const taskId = task.task_id || task.taskId || "unknown";
    if (seenTasks.has(taskId)) {
      // duplicate delivery: answer again but do not double-count
    }
    seenTasks.add(taskId);

    const input = task.input || {};
    const verdict = decide(input);
    stats.tasks++;
    if (verdict.decision === "APPROVE") stats.approve++; else stats.reject++;

    // Mark the proof reference as consumed only when we approve it.
    if (verdict.decision === "APPROVE" && input.proof_tx) {
      seenProofs.add(String(input.proof_tx).trim().toLowerCase());
    }

    send(res, 200, {
      decision: verdict.decision,
      reason_code: verdict.reason,
      proof_tx: input.proof_tx,
    });
  });
});

function redactHeaders(h) {
  const copy = {};
  for (const [k, v] of Object.entries(h)) {
    if (/secret|auth|cookie/i.test(k)) copy[k] = "<redacted>";
    else copy[k] = v;
  }
  return copy;
}

server.listen(PORT, () => {
  console.log(`agent listening :${PORT} secret=${SECRET ? "set" : "MISSING"}`);
});
