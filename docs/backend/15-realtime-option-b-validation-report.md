# 15 — Realtime Option B Validation Report

> HOA CONNECT — Backend Integration Program  
> Wave B: Denormalized Direct Ownership for `support_messages`  
> Date: July 19, 2026

---

## 1. Why private Broadcast was rejected

Private Broadcast was tested in the prior remediation wave and rejected because:

- unauthorized topics were denied;
- authorized RT-04 delivery failed;
- no accepted support-message transport resulted.

This wave therefore evaluated Option B instead of reopening `notifications`, ADR-10, or ADR-11.

---

## 2. Selected Option B ownership model under test

Local validation model:

```text
support_messages.tenant_id
support_messages.property_id
support_messages.resident_profile_id
support_messages.resident_user_id
support_messages.resident_access_revoked
support_messages.support_request_id
```

Model classification:

```text
B1 direct resident ownership projection
```

The client supplies only:

- `support_request_id`
- message content

Trusted database logic derives the authorization fields from `support_requests` and `profiles`.

---

## 3. Schema fields and controls

### Added or validated fields

- `tenant_id`
- `property_id`
- `resident_profile_id`
- `resident_user_id`
- `resident_access_revoked`
- `support_request_id`
- `delivery_sequence`

### Consistency controls

- composite foreign key back to `support_requests`
- projection uniqueness on `support_requests`
- trigger-based derivation from parent request

### Trust-boundary controls

- ownership fields ignored from arbitrary client input
- `create_support_message(...)` used as the validation write path
- no direct table write grant to `authenticated`

### Immutability controls

Trigger denies changes after insert to:

- `tenant_id`
- `property_id`
- `resident_profile_id`
- `resident_user_id`
- `support_request_id`

---

## 4. Grants and RLS

### Grants

```sql
GRANT SELECT ON public.support_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_message(...) TO authenticated;
```

No direct `INSERT`, `UPDATE`, or `DELETE` grant to `authenticated`.

### Resident SELECT policy

```sql
resident_user_id = auth.uid()
AND resident_access_revoked = false
```

### Staff SELECT policy

Explicit in-tenant operator authorization only.

### Platform admin SELECT policy

Explicit platform-admin-only access.

### Direct-read boundary

Authenticated residents may read only authorized `support_messages` rows. Other business tables remain denied.

---

## 5. Indexes and plan evidence

Defined support-message indexes:

- `idx_support_messages_tenant_resident_created`
- `idx_support_messages_resident_user_active_created`
- `idx_support_messages_request_created`

Observed local `EXPLAIN` output on July 19, 2026:

- resident tenant+resident read: `Seq Scan`
- support-request ordering read: `Seq Scan`
- cross-tenant denial read: `Seq Scan`

Result:

- logical predicates validated;
- index intent exists;
- actual plan quality is still below target and remains a readiness concern.

---

## 6. SQL test results

Support-message SQL tests:

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

Summary:

```text
10 passed
0 failed
```

---

## 7. Runtime Realtime results

Evidence file:

- [validation/evidence/adr09_support_messages_option_b_probe.json](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/evidence/adr09_support_messages_option_b_probe.json)

### Negative-event observation model

For every expected no-event case, the probe records:

- observation duration;
- subscribed channel state;
- insert timestamp;
- received event buffer;
- baseline count;
- final count;
- explicit pass/fail assertion.

### RT-04 through RT-14

| Case | Expected | Actual | Result |
|---|---|---|---|
| RT-04 | exactly one authorized support payload | one envelope with `Error 401: Unauthorized`, `new = {}` | FAIL |
| RT-05 | no event or envelope on foreign conversation | zero events | PASS |
| RT-06 | unrelated authenticated user receives nothing | zero events | PASS |
| RT-07 | guessed filters reveal nothing | zero events | PASS |
| RT-08 | direct reads return only authorized rows | authorized rows only | PASS |
| RT-09 | minimal approved payload only | no approved payload delivered | FAIL |
| RT-10 | one logical event | one delivered object, but it was an unauthorized envelope | FAIL |
| RT-11 | deterministic ordering | no approved row set available for ordering validation | FAIL |
| RT-12 | revocation stops future delivery | revoked resident still received unauthorized envelope | FAIL |
| RT-13 | concurrent tenants isolated | Tenant A received unauthorized envelopes; Tenant B received own row | FAIL |
| RT-14 | reconnect safe | reconnect subscription received unauthorized envelope | FAIL |

---

## 8. Security assessment

- tenant isolation for direct reads: validated
- conversation ownership derivation: validated in SQL
- spoofing resistance: validated in SQL
- immutability: validated in SQL
- topic or filter enumeration: no foreign activity discovered in probe
- payload minimization: not validated because no approved payload was delivered
- revocation: failed at Realtime layer because an unauthorized envelope was still delivered

Core conclusion:

```text
Option B fixed the row-ownership model in SQL,
but did not fix the Realtime delivery behavior.
```

---

## 9. Remaining risks

- Realtime authorization still diverges from direct row-read authorization.
- Unauthorized envelopes remain observable on paths that should either authorize cleanly or stay silent.
- Resident and request read plans still use sequential scans locally.
- Ordering and duplicate semantics cannot be certified until approved payload delivery exists.

---

## 10. Final D2 verdict

```text
D2 FAIL — SPRINT 1 BLOCKED
```

Smallest next remediation:

```text
Trace and correct the remaining support_messages Realtime authorization mismatch under the Option B schema before testing further transport changes.
```
