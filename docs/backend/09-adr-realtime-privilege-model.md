# ADR-09 — Realtime Privilege Model

## Status

**Notifications retained. `support_messages` remains blocked after Option B runtime revalidation on July 19, 2026.**

ADR-10 and ADR-11 remain validated and unchanged.

---

## Context

The Resident App uses Realtime for two different modules:

- `notifications`
- `support_messages`

They do not share the same validated behavior.

---

## Failed assumption

The original uniform decision was:

```text
postgres_changes + narrow SELECT grant + RLS
```

That remains valid for `notifications`, but failed for `support_messages`.

First D2 failure evidence:

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

That envelope is still a failure because the subscriber learned a foreign write occurred. Required outcome:

```text
no event delivered
```

---

## Notifications

### Retained transport

```text
postgres_changes + narrow SELECT grant + RLS
```

### Grant model

```sql
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

GRANT SELECT ON public.notifications TO authenticated;
```

### Authorization model

- `authenticated` receives `SELECT` on `notifications` only.
- RLS limits visibility to the caller's own `profile_id`.
- No write grants are restored.

### Runtime validation

Retained as validated:

- authorized notification event delivered;
- cross-tenant notification not delivered;
- unrelated authenticated user received nothing.

---

## Support Messages

### Runtime-tested alternatives

#### Rejected alternative A — Private Broadcast

Evaluated previously and rejected because the authorized subscriber path failed at runtime.

```text
support_messages INSERT
→ trusted publisher
→ private topic
→ authorized subscriber
```

Result:

- unauthorized topics were denied;
- authorized delivery path RT-04 failed;
- no accepted replacement transport existed after that wave.

#### Option B evaluated in this wave — Denormalized direct ownership

Validation-only design implemented locally:

```text
postgres_changes
+ narrow SELECT grant
+ immutable server-derived authorization fields
+ direct RLS predicate on support_messages
```

Selected local ownership model:

```text
support_messages.tenant_id
support_messages.property_id
support_messages.resident_profile_id
support_messages.resident_user_id
support_messages.resident_access_revoked
support_messages.support_request_id
```

### Trust boundary

Clients submit only:

- `support_request_id`
- message content

Trusted database logic derives:

- `tenant_id`
- `property_id`
- `resident_profile_id`
- `resident_user_id`
- revocation state

### Grant model

```sql
GRANT SELECT ON public.support_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_message(...) TO authenticated;
```

No direct `INSERT`, `UPDATE`, or `DELETE` grant to `authenticated`.

### Authorization model

Resident read predicate:

```sql
resident_user_id = auth.uid()
AND resident_access_revoked = false
```

Additional explicit policies exist for:

- authorized operator access in-tenant;
- platform administrator access.

### Immutability model

Protected after insert:

- `tenant_id`
- `property_id`
- `resident_profile_id`
- `resident_user_id`
- `support_request_id`

Mutation attempts are denied by trigger.

### Payload model

Expected runtime payload was limited to the approved message row shape already exposed by `postgres_changes`.

Forbidden fields remained excluded from the validation schema:

- internal operator notes;
- audit metadata;
- private contact data;
- service metadata.

### Direct-read behavior

Direct authenticated reads were intentionally restricted by RLS to authorized rows only.

### Runtime evidence

Machine-readable evidence:

- [validation/evidence/adr09_support_messages_option_b_probe.json](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/evidence/adr09_support_messages_option_b_probe.json)

Observed July 19, 2026 behavior for the authorized resident subscription:

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

That means Option B still failed the decisive condition:

```text
authorized participant receives one approved event payload
and
foreign users receive no event envelope
```

### Validation outcome

SQL controls passed:

- DB-01 through DB-10 passed in the local validation model;
- spoofed ownership values were overwritten or denied;
- ownership mutation was denied;
- direct reads remained tenant-safe.

Runtime controls failed:

- RT-04 authorized delivery failed;
- RT-10 logical single delivery failed because the delivered object was an unauthorized envelope;
- RT-11 ordering could not be validated from approved rows;
- RT-12 revocation still delivered an unauthorized envelope;
- RT-13 concurrent tenant subscriptions still emitted unauthorized envelopes to Tenant A;
- RT-14 reconnect still delivered an unauthorized envelope.

### Performance note

The validation queries are protected logically, but the July 19, 2026 local `EXPLAIN` output still showed `Seq Scan` plans for:

- resident read by `tenant_id + resident_profile_id`;
- request read by `support_request_id`;
- cross-tenant denial path.

This is not the D2 blocker, but it remains an unresolved readiness concern.

---

## Decision

### Accepted

- `notifications` stays on `postgres_changes` with narrow `SELECT` and RLS.

### Rejected

- private Broadcast is rejected for `support_messages`;
- Option B is not accepted as a validated transport because runtime evidence still delivers unauthorized envelopes.

### Current state

No accepted `support_messages` Realtime transport exists as of July 19, 2026.

---

## Tenant-isolation guarantees

### Notifications

Validated:

- own-row delivery only;
- no unrelated-user delivery;
- no broad grant reopening.

### Support messages

Not validated:

- foreign filtered subscriptions were silent;
- unrelated authenticated users were silent;
- but the authorized resident path still received unauthorized envelopes instead of row payloads;
- revocation and reconnect cases remained red for the same reason.

---

## Operational consequences

- Notifications can proceed under the retained model.
- `support_messages` cannot proceed to Sprint 1.
- The current Option B schema proves the trust boundary and immutability model locally, but not the Realtime transport semantics.
- Further remediation must focus on why local Realtime still evaluates the authorized `support_messages` row as unauthorized at delivery time.

---

## Rollback / revision conditions

ADR-09 remains reopened for `support_messages` until one design proves all of the following at runtime:

1. authorized support event delivered as a row payload;
2. foreign and cross-tenant inserts produce no event envelope;
3. revocation stops future delivery;
4. reconnect behavior remains silent for foreign events;
5. direct-read and grant boundaries stay narrow.

Smallest next remediation:

```text
Trace and correct the remaining Realtime authorization mismatch for support_messages under Option B before any further transport redesign.
```
