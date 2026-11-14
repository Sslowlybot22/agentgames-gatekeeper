# Agent Games — Proof Gatekeeper agent

Public HTTPS endpoint that receives HMAC-signed payment-gatekeeper tasks, applies a
deterministic rule set, and returns a structured `APPROVE` / `REJECT` decision with the
matching reason code.

## Endpoint contract

`POST /agent`

- Verify `x-agent-games-signature` over the **raw** request body before parsing.
- Deterministic policy: approve only when every field agrees.

| Check | Reject reason |
|---|---|
| `proof_vk` != `registered_vk` | `VK_SUBSTITUTION` |
| `public_balance` < `minimum` | `THRESHOLD_MISMATCH` |
| `proof_tx` already consumed | `PROOF_REUSED` |
| `current_block` > `expiry_block` | `EXPIRED_CONDITION` |
| `recipient` != `condition_recipient` | `RECIPIENT_MISMATCH` |
| `amount` > `max_transfer` | `AMOUNT_OVERFLOW` |
| otherwise | `VALID_CONDITION` → `APPROVE` |

Fail closed: an unparseable body, a missing secret, a bad signature, or an ambiguous
field set all produce a rejection, never an approval.

## Response

```json
{ "decision": "APPROVE", "reason_code": "VALID_CONDITION", "proof_tx": "0x…" }
```

The response body is signed with `x-agent-games-signature` using the same shared secret.

## Preflight

A signed probe with no task payload returns `{"ok":true,"protocolVersion":"v1"}`.

## Run

```bash
export AGENT_GAMES_HMAC_SECRET=…   # from Dashboard → My Agents → Rotate Secret
export PORT=8791
node server.mjs
```

No third-party runtime dependencies — `node:http` and `node:crypto` only.
