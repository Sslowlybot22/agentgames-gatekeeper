// Optional zkVerify finalisation through the Kurier relay.
//
// Not required for scoring: the platform re-verifies every proof against its own
// registered key, and proof_tx is only an "optional on-chain audit pointer". This
// path activates only when KURIER_API_KEY is set, so the endpoint never depends on
// a third-party relay being up inside the 60-second decision window.
const API_URL = process.env.KURIER_API_URL || "https://api.kurier.xyz/api/v1";
const API_KEY = process.env.KURIER_API_KEY || "";
export const VK_HASH =
  process.env.GATEKEEPER_VK_HASH ||
  "0x6b79c6012a6d8651f3e13bc4d2a20370280ab49700c90c5316d4168bfbad77b0";

export const enabled = () => Boolean(API_KEY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function finalize(evidence, { budgetMs = 20_000 } = {}) {
  if (!API_KEY) throw new Error("kurier disabled");

  const t0 = Date.now();
  const key = encodeURIComponent(API_KEY);

  const call = async (path, body) => {
    const res = await fetch(`${API_URL}/${path}`, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8_000),
      redirect: "error",
    });
    if (!res.ok) throw new Error(`relay ${res.status}`);
    return res.json();
  };

  const job = await call(`submit-proof/${key}`, {
    proofType: "groth16",
    vkRegistered: true,
    proofOptions: { library: "snarkjs", curve: "bn128" },
    proofData: {
      proof: evidence.proof,
      publicSignals: evidence.public_signals,
      vk: VK_HASH,
    },
  });

  while (Date.now() - t0 < budgetMs) {
    const st = await call(`job-status/${key}/${encodeURIComponent(job.jobId)}`);
    if (st.jobId !== job.jobId) throw new Error("relay job mismatch");
    if (st.status === "Failed") throw new Error("relay verification failed");
    if (st.status === "Finalized") {
      if (!st.txHash) throw new Error("missing finalized tx");
      return { jobId: job.jobId, txHash: st.txHash };
    }
    await sleep(1_000);
  }
  throw new Error("relay timeout");
}
