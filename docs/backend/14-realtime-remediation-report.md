# 14 — Realtime Remediation Report

> HOA CONNECT — Backend Integration Program  
> Realtime Remediation Wave B for `support_messages`
> Date: July 19, 2026

---

## 1. Failure recap

Original ADR-09 assumption:

```text
notifications and support_messages can both use
postgres_changes + narrow SELECT grant + RLS
```

That assumption failed for `support_messages` in the earlier D2 runtime wave because Resident A received:

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

Why this is still a failure:

- the client received an event envelope;
- the envelope revealed that a foreign write occurred;
- `401 inside an event` is not equivalent to isolation;
- required result was `no event delivered`.

---

## 2. Options evaluated

### Option A — Private Broadcast

Rejected in the prior remediation wave.

Observed result:

- unauthorized topics were denied;
- authorized support delivery path failed;
- no accepted transport resulted.

### Option B — Denormalized direct ownership

Implemented in this wave and revalidated locally.

Decision rule used:

```text
accept only if authorized payload delivery succeeds
and foreign or unrelated users receive no event envelope
```

### Result

- Option A remains rejected.
- Option B local SQL controls passed.
- Option B Realtime runtime still failed.

---

## 3. Revised architecture under test

### Transport

```text
support_messages on postgres_changes
```

### Grant model

```sql
GRANT SELECT ON public.support_messages TO authenticated;
```

No direct `INSERT`, `UPDATE`, or `DELETE` grant to `authenticated`.

### Server-derived ownership

Derived on insert from `support_requests`:

- `tenant_id`
- `property_id`
- `resident_profile_id`
- `resident_user_id`
- `resident_access_revoked`

### Authorization model

Resident predicate:

```sql
resident_user_id = auth.uid()
AND resident_access_revoked = false
```

Separate policies exist for:

- authorized staff;
- platform administrators.

### Immutability controls

After insert, trigger protection denies changes to:

- `tenant_id`
- `property_id`
- `resident_profile_id`
- `resident_user_id`
- `support_request_id`

### Direct-read behavior

Direct authenticated reads were allowed only through narrow `SELECT` plus RLS and returned authorized rows only.

---

## 4. Test environment

| Field | Value |
|---|---|
| Project | local Supabase CLI stack `aistudio-hoa-connect-resident-app` |
| API | `http://127.0.0.1:54331` |
| DB | `127.0.0.1:54332` |
| Supabase CLI | `v2.107.0` |
| Postgres | `17.6` |
| Realtime image | `public.ecr.aws/supabase/realtime:v2.107.5` |
| Isolation proof | loopback-only local stack, no hosted refs, no production access |

Reset procedure:

1. apply `validation/d2_setup.sql`
2. run `validation/adr09_adr10_sql_tests.sql`
3. run `validation/adr09_adr10_runtime_probe.mjs`

Evidence:

- [validation/evidence/adr09_support_messages_option_b_probe.json](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/evidence/adr09_support_messages_option_b_probe.json)

---

## 5. Runtime results

| Case | Expected | Actual | Result |
|---|---|---|---|
| RT-01 | exactly one event delivered | one notification payload delivered | PASS |
| RT-02 | no event delivered | no foreign notification event | PASS |
| RT-03 | no event delivered | unrelated notification subscriber received nothing | PASS |
| RT-04 | exactly one approved support payload | one delivered envelope with `errors: ["Error 401: Unauthorized"]` and empty row | FAIL |
| RT-05 | no event, no envelope, no metadata | zero events on foreign request filter | PASS |
| RT-06 | no event delivered | unrelated authenticated user received nothing | PASS |
| RT-07 | no foreign activity discovered | guessed request filter revealed nothing | PASS |
| RT-08 | only authorized rows on direct read | authorized rows only | PASS |
| RT-09 | minimal approved payload | no approved payload delivered | FAIL |
| RT-10 | one logical event | one envelope delivered, but not one authorized row payload | FAIL |
| RT-11 | stable ordering | ordering could not be validated from approved rows | FAIL |
| RT-12 | no further event after revocation | revoked resident still received unauthorized envelope | FAIL |
| RT-13 | zero cross-tenant leakage | concurrent Tenant A subscription received unauthorized envelopes | FAIL |
| RT-14 | reconnect safe, no foreign replay | reconnect subscription received unauthorized envelope | FAIL |

---

## 6. Security assessment

- tenant-safe direct reads validated in SQL and runtime read checks;
- ownership spoofing and mutation were blocked in SQL;
- unrelated and guessed-filter subscribers remained silent;
- cross-tenant filtered subscription remained silent;
- the blocking issue is still unauthorized envelope delivery on the authorized resident subscription path.

This means conversation isolation is still not validated, because the transport is still leaking activity metadata through envelopes.

---

## 7. Operational assessment

- delivery semantics for authorized residents remain invalid;
- duplicate semantics cannot be accepted while the transport returns unauthorized envelopes;
- ordering cannot be certified without approved row payloads;
- reconnect remains unsafe for certification for the same reason;
- observability is sufficient for local diagnosis because the machine-readable probe captures event buffers and negative-event timing.

Future hardening still needed even after the authorization bug is fixed:

- explain why Realtime authorization still diverges from direct row reads;
- tune the `support_messages` read path away from current sequential scans;
- document duplicate/idempotency handling after approved row delivery exists.

---

## 8. D2 verdict

```text
D2 FAIL — SPRINT 1 BLOCKED
```

Smallest next remediation:

```text
Trace and correct the remaining Realtime authorization mismatch for support_messages under Option B.
```
