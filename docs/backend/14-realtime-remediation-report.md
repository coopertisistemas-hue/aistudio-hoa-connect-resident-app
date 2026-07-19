# 14 — Realtime Remediation Report

> HOA CONNECT — Backend Integration Program  
> Realtime Remediation Wave for `support_messages`  
> Date: **July 19, 2026**

---

## 1. Failure recap

Original ADR-09 assumption:

```text
notifications and support_messages can both use
postgres_changes + narrow SELECT grant + RLS
```

That assumption failed for `support_messages` in the first D2 validation wave.

Observed foreign event envelope:

```json
{
  "schema": "public",
  "table": "support_messages",
  "eventType": "INSERT",
  "new": {},
  "old": {},
  "errors": ["Error 401: Unauthorized"]
}
```

Why that is still a failure:

- the subscriber learned that a foreign write occurred;
- the required outcome was `no event delivered`;
- an unauthorized envelope is still cross-conversation leakage.

---

## 2. Options evaluated

### Option A — Private Broadcast

Tested in this wave.

Validation transport:

```text
support_messages INSERT
→ trusted trigger
→ realtime.send(...)
→ private topic support-request:<opaque-id>
→ authorized subscriber
```

### Option B — Denormalized direct ownership predicate

Not implemented in this wave.

Reason:

- Option A was the smaller change that preserved direct-read denial and payload minimization;
- Option A had to be tested first before duplicating ownership onto the row.

### Decision criteria

Accept only a design that proves:

```text
authorized participant receives the event
and
unauthorized user receives no event, envelope, or metadata
```

### Result

- Option A was **runtime-tested and rejected**.
- Option B is the **smallest next remediation**.

---

## 3. Revised architecture state

### Notifications

Retained:

```text
postgres_changes + narrow SELECT grant + RLS
```

This path remains validated.

### Support messages

Attempted private-Broadcast design:

- `support_messages` removed from the publication;
- direct authenticated read revoked;
- opaque topic stored as `support-request:<non-guessable-id>`;
- trusted trigger published minimized payloads through `realtime.send(...)`;
- `realtime.messages` RLS added for channel authorization.

Join-probe facts discovered in local runtime:

- Realtime requires an insert-authorizable probe row on `realtime.messages`;
- observed probe shape:
  - `topic=<requested topic>`
  - `extension='broadcast'`
  - `event IS NULL`
  - `payload IS NULL`
  - `private=false`

Even after matching that probe shape with a constrained insert policy, authorized subscribers still received:

```text
CHANNEL_ERROR
```

No support-message replacement transport is accepted yet.

---

## 4. Test environment

| Field | Value |
|---|---|
| Project | local Supabase CLI `aistudio-hoa-connect-resident-app` |
| API | `http://127.0.0.1:54331` |
| DB | `127.0.0.1:54332` |
| Supabase CLI | `v2.107.0` |
| Postgres image | `public.ecr.aws/supabase/postgres:17.6.1.136` |
| Realtime image | `public.ecr.aws/supabase/realtime:v2.107.5` |
| Proof of isolation | loopback-only; repo-local config; no hosted project refs; no production access |

Reset procedure:

1. run `validation/d2_setup.sql`
2. allow local services to settle briefly
3. run SQL validation
4. run runtime probe

Evidence file:

- [validation/evidence/adr09_support_messages_broadcast_probe.json](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/evidence/adr09_support_messages_broadcast_probe.json)

---

## 5. Runtime results

| Case | Expected | Actual | Result |
|---|---|---|---|
| RT-01 | exactly one event delivered | one notification event delivered | PASS |
| RT-02 | no event delivered | no foreign notification payload | PASS |
| RT-03 | no event delivered | zero notification events | PASS |
| RT-04 | exactly one support event delivered | `CHANNEL_ERROR`, zero events | FAIL |
| RT-05 | no event, no envelope, no metadata | zero foreign-topic events, but authorized path still red | FAIL |
| RT-06 | unrelated user denied or silent | join rejected | PASS |
| RT-07 | guessed topic reveals nothing | guessed topic rejected / timed out | PASS |
| RT-08 | direct authenticated read denied | `403 permission denied for table support_messages` | PASS |
| RT-09 | minimal approved payload only | no payload because authorized delivery failed | FAIL |
| RT-10 | one logical event | zero events | FAIL |
| RT-11 | stable order | no authorized events | FAIL |
| RT-12 | revoked access stops future events | no post-rotation events, but subscription never validated | FAIL |
| RT-13 | zero cross-tenant leakage | zero cross-tenant topic events | PASS |
| RT-14 | reconnect safe and documented | reconnect authorization failed | FAIL |

---

## 6. Security assessment

- Notifications remain tenant-safe.
- Support-message private topics improved enumeration resistance.
- Direct authenticated reads to `support_messages` were denied in the attempted replacement.
- The attempted replacement still failed the primary functional security condition because it did not deliver authorized events.
- No minimized support-message payload can be certified until RT-04 is green.

---

## 7. Operational assessment

- Trusted trigger publish path is straightforward.
- Payload minimization is straightforward.
- Direct-read denial is straightforward.
- The blocking behavior is private-topic authorization in the local Realtime runtime.
- Ordering, duplicate suppression, reconnect semantics and revocation remain unresolved because authorized delivery never validated.

---

## 8. D2 verdict

```text
D2 FAIL — SPRINT 1 BLOCKED
```

Smallest next remediation:

```text
Implement and validate Option B — denormalized direct ownership predicate for support_messages.
```
