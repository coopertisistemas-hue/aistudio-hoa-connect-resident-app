# 13 — D2 Validation Report

> Backend Integration Program — D2 Validation Gate Wave  
> Historical failed wave. Superseded on July 19, 2026 by [16-realtime-authorization-diagnostic-report.md](16-realtime-authorization-diagnostic-report.md).

---

## 1. Current D2 state

```text
D2 FAIL — SPRINT 1 BLOCKED
```

Blocking item:

```text
ADR-09 support_messages realtime isolation unresolved
```

Retained as validated:

- `notifications` Realtime;
- ADR-10 profile authorization;
- ADR-11 frontend error compatibility.

---

## 2. Environment

| Field | Value |
|---|---|
| Repository | `aistudio-hoa-connect-resident-app` |
| Branch | `d2-validation-wave` |
| Validation date | July 19, 2026 |
| Local project | Supabase CLI stack for `aistudio-hoa-connect-resident-app` |
| API URL | `http://127.0.0.1:54331` |
| DB URL | `127.0.0.1:54332` |
| Supabase CLI | `v2.107.0` |
| Postgres | PostgreSQL `17.6` in local Supabase container |
| Realtime | `public.ecr.aws/supabase/realtime:v2.107.5` |
| Proof of isolation | loopback-only endpoints, repo-local stack, no hosted project refs, no production credentials |

Reset procedure used:

1. run `validation/d2_setup.sql`
2. run `validation/adr09_adr10_sql_tests.sql`
3. run `validation/adr09_adr10_runtime_probe.mjs`

---

## 3. Wave B summary

This remediation wave implemented and validated Option B for `support_messages`:

```text
postgres_changes
+ narrow SELECT grant
+ direct denormalized ownership
+ immutable server-derived authorization fields
+ direct indexed-intended RLS predicate
```

Artifacts:

- [validation/d2_setup.sql](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/d2_setup.sql)
- [validation/adr09_adr10_sql_tests.sql](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr09_adr10_sql_tests.sql)
- [validation/adr09_adr10_runtime_probe.mjs](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr09_adr10_runtime_probe.mjs)
- [validation/evidence/adr09_support_messages_option_b_probe.json](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/evidence/adr09_support_messages_option_b_probe.json)

Private Broadcast remains a rejected alternative. It is not the selected architecture.

---

## 4. SQL validation summary

`support_messages` Option B controls passed in the local validation schema:

- DB-01 derived tenant: PASS
- DB-02 derived resident owner: PASS
- DB-03 spoofed tenant: PASS
- DB-04 spoofed resident: PASS
- DB-05 ownership mutation denied: PASS
- DB-06 parent mismatch projection enforcement: PASS
- DB-07 direct cross-tenant resident read denied: PASS
- DB-08 staff without support permission denied: PASS
- DB-09 authorized staff read allowed: PASS
- DB-10 revoked membership future reads denied: PASS

SQL totals for Option B support-message controls:

```text
10 passed
0 failed
```

Additional retained SQL checks:

- RT-08 direct read boundary through PostgREST-compatible access: PASS
- ADR-10 validation remained green in the same suite

---

## 5. Runtime matrix

| Case | Expected | Actual | Result |
|---|---|---|---|
| RT-01 | exactly one notification event | one notification event delivered | PASS |
| RT-02 | no cross-tenant notification | zero foreign notification events | PASS |
| RT-03 | unrelated user receives nothing | zero notification events | PASS |
| RT-04 | exactly one authorized support event payload | one delivered envelope, but `new = {}` with `Error 401: Unauthorized` | FAIL |
| RT-05 | foreign support message yields no event or envelope | zero events | PASS |
| RT-06 | unrelated authenticated user receives nothing | zero events | PASS |
| RT-07 | guessed request filter reveals nothing | zero events | PASS |
| RT-08 | authenticated direct reads return only authorized rows | authorized rows only | PASS |
| RT-09 | minimal approved payload only | no approved payload delivered; only unauthorized envelope on RT-04 | FAIL |
| RT-10 | one logical event for one insert | one delivered object, but it was an unauthorized envelope rather than a valid row payload | FAIL |
| RT-11 | stable ordering from approved fields | no approved rows delivered for ordering validation | FAIL |
| RT-12 | revocation stops future delivery | revoked resident still received an unauthorized envelope | FAIL |
| RT-13 | concurrent tenant subscriptions stay isolated | Tenant A received unauthorized envelopes during concurrent run; Tenant B received its own row | FAIL |
| RT-14 | reconnect yields no foreign leak and no unexpected replay | reconnect subscription received an unauthorized envelope | FAIL |

Primary failure evidence:

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

That remains a failed isolation result.

---

## 6. Security assessment

- `notifications` remains green.
- Direct table reads for `support_messages` remained tenant-safe under RLS.
- Ownership fields were server-derived and immutable in the validation model.
- Foreign filtered subscriptions and unrelated users were silent.
- The decisive failure is still the authorized resident path receiving unauthorized envelopes instead of row payloads.
- Revocation and reconnect cases are also red because the same envelope behavior persists.

---

## 7. Performance assessment

The local validation plans on July 19, 2026 were not yet satisfactory:

- resident read by `tenant_id + resident_profile_id`: `Seq Scan`
- request read by `support_request_id`: `Seq Scan`
- cross-tenant denial path: `Seq Scan`

This is a readiness concern, but not the D2 blocking item. D2 remains blocked on Realtime isolation and authorized delivery first.

---

## 8. ADR conclusions

### ADR-09

- `notifications`: retained and validated
- `support_messages`: Option B SQL model validated, Realtime transport still not validated

### ADR-10

Retained as previously validated.

### ADR-11

Retained as previously validated.

---

## 9. Smallest next remediation

```text
Trace and correct the remaining Realtime authorization mismatch for support_messages under the Option B schema.
```

That is smaller than another transport redesign because:

- ownership derivation and immutability already validate in SQL;
- the runtime failure still manifests as `Error 401: Unauthorized` envelopes on rows that should authorize for the resident subscriber.

---

## 10. Final verdict

```text
D2 FAIL — SPRINT 1 BLOCKED
```
