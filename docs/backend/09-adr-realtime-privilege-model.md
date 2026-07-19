# ADR-09 — Realtime Privilege Model

## Status

**Notifications path retained. Support-messages path unresolved after remediation validation on July 19, 2026.**

Dependent on ADR-07. ADR-10 and ADR-11 remain validated and unchanged.

---

## Context

The Resident App needs Realtime for two different surfaces:

- `notifications`
- `support_messages`

These surfaces no longer share one validated transport model.

---

## Failed assumption

The original July 19, 2026 D2 validation accepted one uniform model:

```text
postgres_changes + narrow SELECT grant + RLS
```

That remained valid for `notifications`, but failed for `support_messages`.

Runtime evidence from the first D2 validation wave:

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

That envelope was delivered to a resident who was not authorized for the foreign conversation.

`401 inside an event` is still a failed isolation outcome because the subscriber learned that a foreign write occurred.

---

## Notifications

### Retained model

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
- RLS constrains visibility to `profile_id = current_profile_id()`.
- No write grants are restored.

### Validation state

Retained as **validated** from the D2 validation wave and re-observed during the remediation rerun:

- authorized notification delivered;
- unrelated authenticated user received nothing;
- broad grants remained revoked.

---

## Support Messages

### Options evaluated

#### Option A — Private Broadcast

Attempted design:

```text
support_messages INSERT
→ trusted trigger
→ realtime.send(...)
→ private topic support-request:<opaque-id>
→ authorized subscriber
```

Validation-only implementation details:

- `support_messages` removed from `supabase_realtime` publication;
- `authenticated` `SELECT` on `support_messages` revoked;
- `support_requests.realtime_topic` added as an opaque channel key;
- trusted trigger published a minimized payload through `realtime.send(...)`;
- Realtime channel authorization used `realtime.messages` RLS with:
  - `SELECT` policy scoped by topic authorization;
  - constrained `INSERT` probe policy for the join handshake only.

#### Option B — Denormalized direct predicate

Evaluated as the fallback path:

- duplicate direct ownership columns onto the Realtime-visible row;
- keep `postgres_changes`;
- replace join-based policy with a direct predicate.

This option was **not implemented in this remediation wave** because the private-Broadcast path was tested first as the smaller security-preserving change.

---

## Runtime evidence for the private-Broadcast attempt

Validation environment:

- local Supabase CLI project `aistudio-hoa-connect-resident-app`
- Supabase CLI `v2.107.0`
- Postgres image `public.ecr.aws/supabase/postgres:17.6.1.136`
- Realtime image `public.ecr.aws/supabase/realtime:v2.107.5`
- Kong image `public.ecr.aws/supabase/kong:2.8.1`
- loopback API `http://127.0.0.1:54331`
- loopback DB `127.0.0.1:54332`

Observed secure join-probe shape from the local Realtime stack:

```text
INSERT INTO realtime.messages (topic, updated_at, inserted_at, extension) RETURNING *
```

Observed inserted values:

```text
topic=<requested private topic>
extension=broadcast
event=NULL
private=false
payload=NULL
```

That proved the local stack requires `realtime.messages` insert authorization even for a read-only private-channel join.

The remediation therefore constrained the join probe to:

- authorized topic only;
- `extension = 'broadcast'`;
- `event IS NULL`;
- `payload IS NULL`;
- `private = false`;
- `binary_payload IS NULL`.

Even with that constrained probe policy, the July 19, 2026 runtime rerun still produced:

- `RT-04`: authorized resident subscription rejected with `CHANNEL_ERROR`;
- `RT-06`: unrelated user rejected;
- `RT-07`: guessed topic rejected;
- `RT-08`: direct `support_messages` table read denied as intended.

This means the private-Broadcast transport did not reach the minimum required outcome:

```text
authorized participants receive support-message events
```

and therefore could not be accepted.

---

## Decision

### Accepted

- `notifications` remain on `postgres_changes` with narrow `SELECT` grant and RLS.

### Rejected

- `support_messages` private Broadcast is **rejected for this wave**.

Reason:

- the authorized subscriber could not be validated end to end in the local runtime;
- no accepted runtime result exists for RT-04, RT-11 or RT-14;
- a broader Realtime write policy would have been the next escalation point, and that would need a separate security review because it changes client-channel write semantics.

### Not yet accepted

- no replacement transport for `support_messages` is accepted as of July 19, 2026.

---

## Direct-read behavior

### Notifications

- direct authenticated read remains allowed only through the narrow `SELECT` + RLS exception.

### Support messages

- direct authenticated read is denied in the private-Broadcast attempt.
- this boundary is preferred and was preserved in the remediation validation.

---

## Tenant-isolation guarantees

### Notifications

Validated:

- own-row delivery only;
- no unrelated-user delivery;
- no broad grant reopening.

### Support messages

Not validated:

- unauthorized users were denied private-topic joins;
- authorized users were also denied;
- the transport therefore did not satisfy the functional security contract.

---

## Operational consequences

For the attempted private-Broadcast design:

- trusted publish trigger is straightforward;
- payload minimization is straightforward;
- direct-read denial is straightforward;
- channel-join authorization remains the blocking behavior.

Revocation, duplicate suppression, ordering and reconnect semantics cannot be accepted until RT-04 succeeds first.

---

## Rollback / revision conditions

ADR-09 remains reopened for `support_messages` until one of the following is validated:

1. a corrected private-Broadcast authorization model that passes RT-04 through RT-14, or
2. a denormalized direct-predicate model that proves `no event delivered` for foreign conversations and still meets payload and direct-read requirements.

Current smallest next remediation:

```text
Implement and validate Option B — denormalized direct ownership predicate for support_messages.
```

---

## Current verdict

```text
D2 FAIL — SPRINT 1 BLOCKED
```
