// Agent Games · Proof Gatekeeper agent endpoint.
// POST /agent  — HMAC-verified task envelope in, signed decision out.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { prove } from "./gatekeeper.mjs";

const PORT = Number(process.env.PORT || 8787);
const SECRET = process.env.AGENT_GAMES_HMAC_SECRET || "";
const LOG = path.join(process.env.HOME, "agentgames", "agent", "log.jsonl");

const seenProofs = new Set();
const seenTasks = new Map();
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
  "EXPIRED_CONDITION",
  "RECIPIENT_MISMATCH",
  "AMOUNT_OVERFLOW",
];

function normAddr(a) { return String(a ?? "").trim().toLowerCase(); }
function big(v) { try { return BigInt(String(v ?? "0").trim()); } catch { return null; } }

function decide(input) {
  const findings = [];

  const regVk = normAddr(input.registered_vk);
  const proofVk = normAddr(input.proof_vk);
  if (!regVk || regVk !== proofVk) findings.push("VK_SUBSTITUTION");

  const min = big(input.minimum);
  const bal = big(input.public_balance);
  if (min === null || bal === null || bal < min) findings.push("THRESHOLD_MISMATCH");

  const expiry = big(input.expiry_block);
  const cur = big(input.current_block);
  // Expired once current >= expiry; the condition window is half-open.
  if (expiry === null || cur === null || cur >= expiry) findings.push("EXPIRED_CONDITION");

  const rcpt = normAddr(input.recipient);
  const want = normAddr(input.condition_recipient);
  if (!rcpt || rcpt !== want) findings.push("RECIPIENT_MISMATCH");

  const amt = big(input.amount);
  const cap = big(input.max_transfer);
  if (amt === null || cap === null || amt > cap) findings.push("AMOUNT_OVERFLOW");

  // Reuse outranks every policy finding: a valid proof does not gain re-entry.
  const ref = normAddr(input.proof_tx);
  if (!ref || seenProofs.has(ref)) return { decision: "REJECT", reason: "PROOF_REUSED" };

  const first = findings.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0];
  if (first) return { decision: "REJECT", reason: first };
  return { decision: "APPROVE", reason: "VALID_CONDITION" };
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
  req.on("end", async () => {
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
    seenTasks.set(taskId, Date.now());

    const input = task.input || {};
    const verdict = decide(input);
    stats.tasks++;
    if (verdict.decision === "APPROVE") stats.approve++; else stats.reject++;

    const reply = {
      decision: verdict.decision,
      reason_code: verdict.reason,
      proof_tx: input.proof_tx,
    };

    // PROOF_REUSED tasks carry no proof; every other task gets a Groth16 proof.
    if (verdict.reason !== "PROOF_REUSED") {
      try {
        const t0 = Date.now();
        const ev = await prove(task, verdict.decision);
        reply.proof = ev.proof;
        reply.public_signals = ev.public_signals;
        stats.proofs = (stats.proofs || 0) + 1;
        logRec({ kind: "proof", ms: Date.now() - t0, signals: ev.public_signals.length });
      } catch (e) {
        stats.proofFail = (stats.proofFail || 0) + 1;
        logRec({ kind: "proof_fail", error: String(e.message || e).slice(0, 300) });
      }
    }

    // Mark the proof reference as consumed only when we approve it.
    if (verdict.decision === "APPROVE" && input.proof_tx) {
      seenProofs.add(String(input.proof_tx).trim().toLowerCase());
    }

    send(res, 200, reply);
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
