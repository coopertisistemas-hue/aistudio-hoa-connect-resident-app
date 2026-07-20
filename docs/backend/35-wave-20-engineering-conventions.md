# 35 — Wave 2.0 Engineering Conventions

**Type:** Frozen engineering conventions for Sprint 2
**Wave:** 2.0
**Status:** FROZEN — binding on waves 2.1 … 2.7
**Date:** 2026-07-20

**Nature of this document.** These are *conventions*, not designs. They fix **how**
Sprint 2 code is written, named, organized and reviewed. **What** is built is fixed by
documents 27–31 and is not restated here. Where a convention derives from an approved
decision, the decision is cited; this document introduces no new architecture.

**Amendment rule.** Frozen means a convention changes only by executive authorization
recorded in a numbered document — not by an edit during implementation. This mirrors the
frozen-list rule (document 33 §5 item 2), for the same reason: a standard that can be
edited by the person it constrains is not a standard.

---

## 1. Repository organization

The certified Sprint 1 layout is the convention. Sprint 2 extends it by **prefix**, not
by nesting.

| Path | Holds | Sprint 2 rule |
|---|---|---|
| `supabase/migrations/` | timestamped forward-only SQL | one migration per wave; `<ts>_sprint02_<wave-topic>.sql` |
| `supabase/functions/<endpoint>/` | one directory per Edge Function | new directories only; Sprint 1 functions untouched |
| `supabase/functions/_shared/` | shared EF helpers | extend additively; no breaking change to Sprint 1 callers |
| `supabase/tests/` | SQL and `.mjs` gate suites | flat, `sprint02_*` prefixed |
| `validation/` | cross-cutting validators and guards | flat; `check_*.sh` for static guards |
| `validation/evidence/` | committed evidence artifacts | flat, `sprint02_*` prefixed |
| `docs/backend/` | numbered, append-only documents | next free number; never renumber |

**No new top-level directories, and no `sprint02/` subdirectories.** Document 27 §9
specifies flat prefixed filenames (`supabase/tests/sprint02_*.sql`), matching certified
Sprint 1 (`sprint01_foundation.sql`, `sprint01_edge_function_auth.test.mjs`,
`sprint01_performance_seed.sql`, `sprint01_performance_explain.sql`). A wave that
introduces nesting contradicts the approved plan and splits the discovery surface for
auditors.

### 1.1 Documentation structure

Documents are numbered, immutable once published, and append-only. A correction is a new
document that supersedes an old one, not an edit — except during an authorized
remediation wave, which must record every edit in a traceability matrix (the pattern of
document 33). Review evidence (document 32) is **never** edited.

`docs/backend/README.md` indexes the architecture set (01–17) and was not extended by
documents 18–33; Wave 2.0 follows that precedent and does not extend it either. Changing
this is a documentation-governance decision, not an implementation-wave decision.

---

## 2. Mutation architecture

**Source: document 30 §1.1 (D-12, RM-01/RM-02). Reproduced here as the binding
convention; document 30 remains authoritative on contract specifics.**

### 2.1 The layer stack

```
Client
  │  HTTPS + user JWT
  ▼
Edge Function          transport · JWT validation · input validation · envelope ·
  │                    error mapping · rate limiting · pagination · response shaping
  │  exactly one RPC call per write request
  ▼
RPC (SECURITY INVOKER) one transaction · all writes · invariant checks RLS cannot
  │                    express · log_audit_event()
  ▼
RLS                    authorization, evaluated as the calling user inside the RPC
  ▼
Transaction            atomic commit of mutation + relationships + history + audit
  ▼
Audit                  append-only audit_events row, same transaction, always
```

### 2.2 RPC conventions (`SECURITY INVOKER`)

Binding on Wave 2.4b and on every later wave that adds a mutation.

1. **`SECURITY INVOKER` is the default and the rule.** `DEFINER` requires named
   executive sanction. Sprint 2 has exactly two sanctioned `DEFINER` RPCs —
   `accept_residence_invitation` and `tenant_audit_events` (document 30 §1.1). A third
   is a scope change, not an implementation detail.
2. **`SET search_path = ''`** on every function; all objects schema-qualified.
3. **No dynamic SQL** except through `format()` with `%I`/`%L`.
4. **Never convert an authorization failure into a success.** Exception handlers must not
   swallow `insufficient_privilege`. This is risk R-21 and is catalog-gated.
5. **One write RPC per request.** An operation needing two writes needs one RPC, not two
   calls.
6. **Authorization lives in RLS, not in the RPC body.** An RPC that re-implements a
   policy check has moved the security boundary and will drift from it.
7. **Naming:** `<entity>_<verb>` in the domain vocabulary of document 33 §4 —
   `resident_create`, `residence_member_end`, `household_member_promote`.

### 2.3 Edge Function conventions

1. Edge Functions are **transport and validation only**. They never write through
   PostgREST — the defect that RM-01/RM-02 exist to correct.
2. Each write endpoint issues **exactly one** RPC call.
3. An Edge Function **must never enforce confidentiality by projection.** If an actor
   must not see a field, that actor must be unable to select it (RM-07). Response shaping
   is permitted only for data the caller may already read.
4. Read endpoints may query PostgREST directly where a single policy-scoped select
   suffices, and use a read RPC where a projection must be *enforced* rather than merely
   applied (document 29 §8).
5. New directories only. Sprint 1 functions are certified and untouched.

### 2.4 Transaction boundaries

1. The RPC **is** the transaction. All-or-nothing.
2. A transaction **never spans two RPC calls**. If two writes must be atomic, they belong
   to one RPC.
3. Domain mutation, relationship updates, history rows and the audit event share **one**
   transaction.
4. **Atomicity is a fail-closed gate, not a claim** (RM-02): an injected failure must
   leave zero domain rows **and** zero audit rows. A wave asserting atomicity without
   exercising that gate has not demonstrated it.

### 2.5 Audit boundaries

1. Every mutation emits an audit event via `log_audit_event()` **inside the mutating
   transaction**. Never after commit, never from an Edge Function, never best-effort.
2. `audit_events` is append-only and immutable — enforced by the certified baseline
   (`ERROR: audit_events are immutable` is an active Sprint 1 gate, observed in the
   Wave 2.0 transcript, document 34 §2.3).
3. If the mutation rolls back, the audit event rolls back with it. An audit row for a
   write that did not happen is a correctness defect of equal severity to a missing one.
4. Partitioning key is **decided** — monthly RANGE on `created_at`, `tenant_id` leading
   in indexes (ARB-23) — and **not implemented in Sprint 2** (D-15 accepted debt). No
   Sprint 2 index or query may assume partitioning exists.

### 2.6 Idempotency

1. **Constraint-based only.** `client_request_id` was removed as unimplementable
   (ARB-19). Idempotency derives from natural keys and unique constraints, so the
   database enforces it regardless of client behavior.
2. **Repeat with an equivalent payload ⇒ 200.** Repeat with a *conflicting* payload ⇒
   **409**, never a silent 200 — a 200 there masks operator error (ARB-20, e.g.
   `UNIT_IDENTIFIER_CONFLICT`).
3. **Double delete ⇒ 200 no-op** (RM-08).
4. **Duplicate invitation ⇒ `409 INVITATION_PENDING`**, with reissue as an explicit
   client intent, never an implicit side effect (RM-04).
5. Clients retry on natural keys; this is a documented contract obligation (ARB-19).

### 2.7 The grant model

**Zero `INSERT`/`UPDATE`/`DELETE` grants to `authenticated` on any table — certified or
new** (RM-06, certified guarantee #3, extended). `EXECUTE ON FUNCTION` is the sole write
boundary. This is machine-checked by SPR2-GRANT-01 and is strictly stronger than the
certified baseline. It is the single easiest convention to violate accidentally by
copying a grant line, and the single most damaging to violate.

---

## 3. Migration conventions

1. **Forward-only, additive.** No production environment exists yet; local rollback is
   `supabase db reset`. From the first persistent environment onward this becomes
   irreversible (D-05) — Wave 2.3 must record that transition.
2. **One migration per wave**, reviewable in one sitting. A constraint change to a
   certified object gets its **own** migration for reviewability (D-05 pattern).
3. Changes to certified objects are permitted **only** for items on the frozen list
   (document 28 §12, 7 items). Anything else requires executive authorization.
4. Every migration applies cleanly on the certified baseline; the Sprint 1 suite must be
   green after it.
5. Naming: `<timestamp>_sprint02_<wave-topic>.sql`, matching
   `20260719170000_sprint01_foundation_identity.sql`.

---

## 4. Validation organization

1. **Static guards** (`validation/check_*.sh`) run on the source tree only — no database,
   no fixtures, no runtime state — so they are safe in any suite position and cannot
   perturb the baseline. `validation/check_d2_namespace.sh` is the reference
   implementation.
2. **Every guard must be negative-tested** before it is trusted, and the negative test
   recorded in the wave report. A guard that has never failed is an untested assertion.
   Wave 2.0 set this precedent (document 34, CF-03).
3. **Namespace ownership:** the `d2_` prefix belongs exclusively to the D2 validation
   suite; no product object may carry it and no `d2_` identifier may appear under
   `supabase/` (CF-03, enforced).
4. **Test roles:** the four unprefixed cluster-global roles are frozen until CF-04 is
   executed (Sprint 3 at the latest). New test roles introduced by Sprint 2 must be
   prefixed, or the CF-03 guard will fail — deliberately.
5. **Suite composition is append-only.** New steps chain into `supabase:test:all`; no
   certified step is reordered or modified. Sprint 1's post-D2 regression re-run stays
   last, so every added step is itself proved non-damaging to the baseline.

---

## 5. Test organization

| Concern | File |
|---|---|
| Schema, constraints, invariants | `supabase/tests/sprint02_domain.sql` |
| RLS / authorization matrix | `supabase/tests/sprint02_rls.sql` |
| RPC behavior and atomicity | `supabase/tests/sprint02_domain.sql` (RPC gates, per document 27 §9 Wave 2.4b) |
| Edge Function auth and contracts | `supabase/tests/sprint02_edge_function_*.mjs` |
| Fixtures | `supabase/tests/sprint02_edge_function_fixtures.sql` |
| Performance | `supabase/tests/sprint02_performance_*.sql` |

Conventions:

1. **Flat and prefixed.** No subdirectories (§1).
2. **Gate IDs are stable and referenced by ID** — `SPR2-RLS-29`, `PERF2-02`, `EF2-F19`.
   A gate's ID never changes; a rewritten gate keeps its ID and records the rewrite
   (PERF2-02 is the precedent).
3. **Every structural change has a gate.** A change with no gate is not done.
4. **Authorization gates read the table as the actor**, never an Edge Function response
   (RM-07). Asserting a field's absence from a JSON body proves the projection ran, not
   that the actor was denied.
5. **Negative gates are mandatory** for every deny rule — cross-tenant, revoked,
   disabled, wrong-permission. Sprint 1's 35 EF-auth gates are the shape to match.
6. Sprint 1 suites run **unmodified** in every wave's regression path.

---

## 6. Documentation verification discipline (CF-05)

Binding on **all** Sprint 2 documents — planning, validation, wave, audit and
certification — not only reports (RM-11, document 27 §14.1).

1. **Every identifier, gate ID, file path and section reference is grep-verified before
   publication.**
2. **Structural claims about code carry a `file:line` citation.** Wave 2.0's RM-09 check
   is the model: the claim "the indexes are not partial" was re-verified directly against
   `supabase/migrations/20260719170000_sprint01_foundation_identity.sql:214-215` rather
   than inherited from a prior document.
3. **Prohibited phrasings:** "should be", "is expected to", "presumably", or any
   uncited assertion about runtime behavior.
4. **Runtime claims are baseline claims.** "The suite passes" requires a transcript from
   *this* wave, not a memory of a previous one.
5. **Each document carries a verification record** (the pattern of document 34 §6).
6. **Auditor hook:** an uncited claim is a MEDIUM finding; a false claim that a gate
   depends on is HIGH.

### 6.1 Evidence handling

**Re-running a certified suite must never rewrite certified evidence.** Regenerated
artifacts differ in timestamps, fingerprints and generated IDs, which produces diff noise
against certified records and can read as tampering with the certified baseline.

The rule, established in Wave 2.0 (document 34 §2.4):

1. Run the suite.
2. Diff the regenerated artifact with volatile fields excluded; confirm no status,
   outcome or result field changed.
3. **Restore the certified artifact** (`git checkout --`).
4. Write this wave's evidence to a **new** `validation/evidence/sprint02_*` artifact.

---

## 7. Performance conventions

**No production SQL optimization is authorized before Wave 2.6.** These are the rules
that wave will follow.

### 7.1 EXPLAIN policy

1. `EXPLAIN (ANALYZE, BUFFERS)` — always both. A plan without buffers cannot support a
   claim about index benefit.
2. **Plans and timings are committed as evidence**, not summarized in prose.
3. **Assert plan shape, not wall-clock time.** Index-scan-vs-seq-scan and buffer counts
   are portable; milliseconds on a local Docker stack are not.
4. **Comparative where a change claims a benefit.** PERF2-02 is the standard: buffer
   counts are compared against the certified composite-index plan, so the benefit of the
   new partial indexes is *measured*. A claimed improvement with no before-plan is an
   uncited claim under §6.
5. **Local-stack timings are not production benchmarks** (Sprint 1 precedent). Any
   document reporting them must say so.

### 7.2 Query review policy

1. Every hot path named in document 31 §5 has a `PERF2-*` gate. A hot path with no gate
   is an unreviewed path — PERF2-08 and PERF2-09 exist because two such paths were found
   during the Executive Review.
2. **No sequential scan on any Sprint 2 table at fixture scale.**
3. **RLS policy plan shape is itself reviewed**, not just application queries — a policy
   predicate is executed on every row touched (PERF2-09 is the precedent).
4. A policy change that alters plan shape requires a before/after plan.

### 7.3 Index review policy

1. **An index's name is not evidence of its structure.** The `_active` suffix on
   `idx_residence_members_profile_active` describes intent; the index is a plain
   composite B-tree on `(profile_id, status)`
   (`...foundation_identity.sql:214-215`). Believing the name caused ARB-14. **Verify
   the definition, cite the line.**
2. Every new index is justified by a gate that shows the planner **choosing** it.
   Unchosen indexes are write-amplification with no reader.
3. Partial indexes state their predicate in the review, and the gate must prove the
   predicate matches the query.
4. Composite index column order is justified against the actual predicate; `tenant_id`
   leads in multi-tenant access paths.
5. Certified indexes are not modified. Sprint 2 **adds** partial indexes rather than
   altering the certified composite ones (RM-09).

### 7.4 Tenant scalability targets

Fixture scale for Wave 2.6, from document 31 §5 — chosen to exceed Sprint 1's certified
scale (51 tenants / 502 properties / 3,257 profiles / 3,004 memberships) and prove
headroom for realistic association scale (R-15):

| Entity | Rows |
|---|---|
| tenants | ≥ 100 |
| properties | ≥ 2,000 |
| profiles | ≥ 10,000 |
| residents | ≥ 10,000 (multi-association profiles included) |
| residence_members | ≥ 25,000 (≥ 30% closed history rows) |
| household_members | ≥ 15,000 |
| residence_payers | ≥ 8,000 (≥ 40% ended) |
| residence_invitations | ≥ 3,000 |
| audit_events | ≥ 100,000 |

Two properties of this scale are deliberate and must be preserved by any fixture
rewrite: **closed history rows** (≥30% of memberships, ≥40% of payers) exist so partial
indexes are tested against realistic dead weight rather than a clean table; and
**multi-association profiles** exist so `current_tenant_context()` is exercised on the
path that actually stresses it.

---

## 8. Execution conventions (per wave)

Every wave 2.1 … 2.7 follows the same loop. Document 36 is the checklist; document 37
applies it to each wave.

1. **Entry:** previous wave's exit criteria met and evidenced; working tree clean.
2. **Implement** strictly within the wave's declared scope.
3. **Gate:** the wave's own gates plus the **full** regression suite
   (`supabase:test:all`), plus typecheck and build.
4. **Evidence:** transcripts and artifacts under `validation/evidence/sprint02_*`;
   certified evidence preserved per §6.1.
5. **Report:** a numbered `docs/backend/` document with a CF-05 verification record.
6. **Stop.** Wait for explicit authorization before the next wave.

Standing prohibitions, binding on every wave:

- Never `push`, `merge` or create a tag without explicit executive authorization.
- Never modify a certified object outside the frozen list.
- Never modify document 32.
- Never edit a published document to fix a claim; supersede it.
- Never widen wave scope to "finish something small" that belongs to the next wave.

---

## 9. Convention verification record (CF-05)

| Convention | Source |
|---|---|
| Layer stack, RPC/EF rules, RPC inventory | document 30 §1.1, read directly |
| Grant model | RM-06 / document 33 §2 |
| Idempotency rules | ARB-19, ARB-20, RM-04, RM-08 / document 33 §3 |
| Audit partitioning decided, not built | ARB-23, D-15 / document 33 §3 |
| Fixture scale table | document 31 §5, read directly |
| PERF2-02 comparative buffer requirement | document 31 §5, read directly |
| Index structure claim | `supabase/migrations/20260719170000_sprint01_foundation_identity.sql:214-215`, read directly and confirmed |
| Flat test-file naming | document 27 §9; `ls supabase/tests/` |
| Sprint 1 fixture scale (51/502/3,257/3,004) | document 31 §5, quoted |
| Audit immutability is an active gate | Wave 2.0 suite transcript, document 34 §2.3 |

These conventions are **frozen**. Waves 2.1–2.7 comply or obtain authorization to differ.
