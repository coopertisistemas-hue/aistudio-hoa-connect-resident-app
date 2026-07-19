# ADR-09 — Realtime Privilege Model

## Status

**Accepted in architecture — runtime validation failed on July 19, 2026.**

Dependent on ADR-07 (PostgREST grant revocation). Blocks Sprint 6 (Communication) and Sprint 7 (Support).

---

## Context

Realtime is the one client-facing path where RLS is load-bearing for normal traffic. Edge Functions use `service_role` and bypass RLS; PostgREST is closed under ADR-07. Only Supabase Realtime evaluates RLS policies when an `authenticated` client subscribes to `postgres_changes`.

The Resident App requires Realtime for:

- notifications (unread badge accuracy);
- support messages and status changes (conversation freshness).

These are backed by `notifications` and `support_messages` respectively.

---

## Problem

ADR-07 proposes:

```sql
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
```

PostgreSQL evaluates table privileges before RLS. If `authenticated` has no `SELECT` on `notifications` and `support_messages`, a Realtime `postgres_changes` subscription on those tables will connect but receive no events. The failure is silent: the client sees a live connection but never gets data, making it worse than an obvious error.

We therefore need a deliberate, minimal, auditable exception to the grant revocation for Realtime-backed tables.

---

## Considered options

### Option A — Narrow table grants

Grant `SELECT` only on the exact tables that require `postgres_changes`, while maintaining RLS isolation.

- Candidate tables: `notifications`, `support_messages`.
- All other grants remain revoked.
- RLS policies restrict each subscription to the caller's own data.

### Option B — Broadcast from database triggers

Use database-triggered Realtime Broadcast rather than direct `postgres_changes`.

- Triggers on `notifications` and `support_messages` emit Broadcast events to private topics such as `resident:{profile_id}`.
- Channels use private topics; clients must pass an access token validated by the Edge Function.
- Payloads are minimized; tenant isolation is enforced by the trigger logic.
- Higher operational complexity: trigger maintenance, payload design, channel authorization, and topic lifecycle.

---

## Decision

Select **Option A — Narrow table grants**.

The grant set for the `authenticated` role on `public` becomes:

```sql
-- ADR-07 baseline: revoke everything.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- ADR-09 exception: SELECT only on Realtime-backed tables.
GRANT SELECT ON public.notifications    TO authenticated;
GRANT SELECT ON public.support_messages TO authenticated;
```

`anon` receives no grants at all.

### RLS requirements for the excepted tables

`notifications`:

```sql
CREATE POLICY "notifications_resident_select" ON public.notifications
  FOR SELECT USING (profile_id = auth.uid());
```

`support_messages` (no direct `profile_id`; joins through `support_requests`):

```sql
CREATE POLICY "support_messages_resident_select" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.support_requests sr
      WHERE sr.id = support_messages.support_request_id
        AND sr.profile_id = auth.uid()
    )
  );
```

Association staff read their tenant's messages through Edge Functions (`service_role`); no `authenticated` staff policy is required on `support_messages` for Realtime.

### Why this is acceptable

- The `authenticated` role can see only what RLS permits. The `SELECT` grant alone does not allow direct SQL reads of another resident's data.
- No `INSERT`/`UPDATE`/`DELETE` grants are restored. Residents still cannot write directly.
- The exception is enumerated (two tables), documented, and audited. Any future Realtime-backed table must pass the same review.
- It preserves the structural guarantee of ADR-07: PostgREST direct access remains impossible except for the two narrow `SELECT` paths.

---

## Consequences

- **Cost:** two explicit `GRANT SELECT` statements and two RLS policies must be maintained.
- **Benefit:** Realtime works as designed with native `postgres_changes`; no trigger layer or custom Broadcast authorization is required.
- **Risk:** a future migration that adds a Realtime-backed table may forget the matching `GRANT SELECT`. Mitigation: checklist item in the migration template; RLS regression test that asserts a subscription receives events.
- **Performance:** the `support_messages` policy requires a join per Realtime event. The access path is indexed (`support_requests(profile_id)` and `support_messages(support_request_id)`).

---

## Rejected alternatives

| Alternative | Reason rejected |
|---|---|
| Grant `SELECT` on all tables to simplify Realtime | Destroys ADR-07 entirely and reopens HIGH-01. |
| Option B — Broadcast from triggers | Adds operational complexity without a proportional benefit for two tenant-scoped tables. Reserved as a future optimization if `postgres_changes` proves insufficient. |
| Skip Realtime entirely | Would regress the certified UX: unread badge and support thread would require manual refresh. |

---

## Validation requirement

Before Sprint 6 implementation, validate in a branch or disposable Supabase project:

1. `anon` cannot subscribe to any Realtime channel.
2. `authenticated` user A receives notifications only where `profile_id = A`.
3. `authenticated` user A receives support messages only for support requests authored by A.
4. `authenticated` user B receives no notifications or messages belonging to A.
5. Revoking `SELECT` on `notifications` and `support_messages` from `authenticated` causes both channels to fall silent (regression test).
6. `authenticated` cannot `INSERT`/`UPDATE`/`DELETE` either table directly via PostgREST.

---

## Rollback or revision conditions

- If validation shows that narrow grants leak data across profiles, immediately revise the RLS policies before expanding the exception.
- If future requirements demand cross-profile or broadcast-style events (e.g., association-wide real-time notices), revisit Option B.
- If Supabase changes Realtime privilege semantics, re-evaluate this ADR.

---

## Validation Outcome — July 19, 2026

Validation ran in the isolated local Supabase CLI project `aistudio-hoa-connect-resident-app`
on branch `d2-validation-wave`, using:

- [validation/d2_setup.sql](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/d2_setup.sql)
- [validation/adr09_adr10_sql_tests.sql](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr09_adr10_sql_tests.sql)
- [validation/adr09_adr10_runtime_probe.mjs](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr09_adr10_runtime_probe.mjs)

Observed runtime evidence:

- `notifications` validated successfully.
  - RT-01 delivered the authorized resident notification at `2026-07-19T09:53:37.862Z`.
  - RT-03 delivered nothing to an unrelated authenticated user during the 2000 ms observation window.
- `support_messages` failed the isolation requirement.
  - RT-04 produced a Realtime event envelope for the authorized request, but the payload contained `errors: ["Error 401: Unauthorized"]` instead of a clean row payload.
  - RT-05 produced another event envelope for a foreign request during the same resident subscription, again with `errors: ["Error 401: Unauthorized"]`.
  - This violates the required outcome `no event delivered to Resident A`.

Architectural implication:

- **Option A is not validated for `support_messages`.**
- The narrow grant plus join-based RLS policy is sufficient for direct SQL/PostgREST reads, but it did not produce tenant-safe runtime isolation in `postgres_changes`.

Smallest required remediation:

- Keep Option A for `notifications`.
- Replace `support_messages` Realtime with a private broadcast model, or denormalize recipient ownership onto `support_messages` so Realtime authorization can be expressed with a direct row predicate and revalidated.

Current ADR-09 verdict:

```text
VALIDATION FAILED — support_messages realtime isolation unresolved
```
