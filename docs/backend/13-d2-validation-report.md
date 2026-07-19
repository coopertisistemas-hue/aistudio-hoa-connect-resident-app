# 13 — D2 Validation Report

> Backend Integration Program — D2 Validation Gate Wave  
> Updated on July 19, 2026 after the Realtime remediation rerun

---

## 1. Current D2 state

```text
D2 FAIL — SPRINT 1 BLOCKED
```

Blocking item:

```text
ADR-09 support_messages realtime isolation unresolved
```

Previously validated and retained:

- ADR-10 — PASS
- ADR-11 — PASS
- notifications realtime narrow-grant model — PASS

---

## 2. Environment

| Field | Value |
|---|---|
| Repository | `aistudio-hoa-connect-resident-app` |
| Branch | `d2-validation-wave` |
| Validation date | **July 19, 2026** |
| Supabase project reference | local CLI project `aistudio-hoa-connect-resident-app` |
| API URL | `http://127.0.0.1:54331` |
| DB URL | `127.0.0.1:54332` |
| Supabase CLI | `v2.107.0` |
| Postgres image | `public.ecr.aws/supabase/postgres:17.6.1.136` |
| Realtime image | `public.ecr.aws/supabase/realtime:v2.107.5` |
| Proof of isolation | loopback-only endpoints; repo-local `supabase/config.toml`; no hosted project refs; no production credentials |

Reset procedure used:

1. `validation/d2_setup.sql`
2. optional settle wait for local Realtime warm-up
3. `validation/adr09_adr10_sql_tests.sql`
4. `validation/adr09_adr10_runtime_probe.mjs`

---

## 3. Remediation rerun summary

The remediation wave tested **Option A — Private Broadcast** for `support_messages` while keeping `notifications` on the already-validated `postgres_changes + narrow SELECT + RLS` path.

Validation-only artifacts:

- [validation/d2_setup.sql](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/d2_setup.sql)
- [validation/adr09_adr10_sql_tests.sql](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr09_adr10_sql_tests.sql)
- [validation/adr09_adr10_runtime_probe.mjs](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr09_adr10_runtime_probe.mjs)
- [validation/evidence/adr09_support_messages_broadcast_probe.json](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/evidence/adr09_support_messages_broadcast_probe.json)

Key implementation facts:

- `support_messages` was removed from `supabase_realtime` publication;
- direct authenticated `SELECT` on `support_messages` was revoked;
- opaque topic `support-request:<non-guessable-id>` was introduced on `support_requests`;
- a trusted trigger published minimized payloads through `realtime.send(...)`;
- `realtime.messages` RLS was added for topic authorization and constrained join probing.

Observed Realtime join-probe shape from the local stack:

```text
topic=<requested topic>
extension=broadcast
event=NULL
payload=NULL
private=false
```

Even after matching that probe shape, authorized private-topic joins still failed.

---

## 4. ADR-09 runtime matrix

| Case | Expected | Actual | Result |
|---|---|---|---|
| RT-01 | exactly one authorized notification event | one notification event delivered | PASS |
| RT-02 | no Tenant B notification to Resident A | no foreign notification payload; no security leak | PASS |
| RT-03 | unrelated authenticated user receives nothing | zero notification events | PASS |
| RT-04 | authorized support participant receives one event | `CHANNEL_ERROR`, zero events, zero payload | FAIL |
| RT-05 | foreign conversation yields no event or envelope | no event payload, but authorized path never validated | FAIL |
| RT-06 | unrelated authenticated user denied or receives zero events | unauthorized private-topic join rejected | PASS |
| RT-07 | guessed opaque topic reveals nothing | guessed topic rejected / timed out with zero events | PASS |
| RT-08 | direct table read matches revised ADR | `403 permission denied for table support_messages` | PASS |
| RT-09 | payload contains approved minimal fields only | no payload because authorized delivery failed | FAIL |
| RT-10 | one logical event for one insert | zero events | FAIL |
| RT-11 | stable reconstructable order | authorized join failed; no ordering evidence | FAIL |
| RT-12 | revoked user receives no further events | no post-revocation events, but precondition subscription never validated | FAIL |
| RT-13 | zero cross-tenant leakage | foreign tenant topic produced zero events | PASS |
| RT-14 | reconnect produces no foreign leak and no unintended replay | reconnect authorization failed | FAIL |

Primary failure evidence from the runtime probe:

```text
RT-04 failed: Resident A support subscription did not authorize (CHANNEL_ERROR)
```

and the Realtime service logged:

```text
Unauthorized: You do not have permissions to read from this Channel topic: support-request:3cdb6d1e...
```

---

## 5. ADR conclusions

### ADR-09

Notifications remain validated.

Support messages remain **not validated**:

- the original `postgres_changes` design failed because foreign event envelopes were delivered;
- the private-Broadcast replacement failed because authorized subscribers could not be validated end to end in the local runtime.

### ADR-10

Retained as previously validated. No new ADR-10 finding was opened in this wave.

### ADR-11

Retained as previously validated. No new ADR-11 finding was opened in this wave.

---

## 6. Security assessment

- Tenant isolation for notifications remains green.
- Support-message unauthorized joins were rejected, which is good, but that is insufficient because the authorized join also failed.
- Topic enumeration resistance improved with opaque topic IDs, but the transport is still unusable because RT-04 is red.
- Direct authenticated reads to `support_messages` stayed denied in the private-Broadcast attempt.
- No validated minimized support-message payload exists because no authorized delivery exists.

---

## 7. Operational assessment

- Trusted trigger publishing is easy to maintain.
- Payload shaping and direct-read denial are straightforward in the attempted design.
- The blocking behavior is private-topic authorization in the local Realtime runtime.
- Reconnect, ordering, duplicate suppression and revocation cannot be accepted until authorized delivery works first.

---

## 8. Smallest next remediation

```text
Implement and validate Option B — denormalized direct ownership predicate for support_messages.
```

Reason:

- Option A private Broadcast was exercised with runtime evidence and still did not validate the authorized subscriber path.
- ADR-10 and ADR-11 are already green and should remain untouched.

---

## 9. Final verdict

```text
D2 FAIL — SPRINT 1 BLOCKED
```
