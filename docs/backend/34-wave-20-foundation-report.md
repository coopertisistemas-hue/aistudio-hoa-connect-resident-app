# 34 — Wave 2.0 Foundation Report

**Type:** Execution report — baseline verification and carry-forward integration
**Wave:** 2.0 (first engineering wave of Sprint 2)
**Status:** COMPLETE
**Date:** 2026-07-20
**Branch:** `sprint-01-foundation-identity`
**Entry HEAD:** `6f0399232515cdfec80f54d7705906715b294387`
**Sprint 1 certified baseline:** `a58a1ed98b0e5299678a41be833729895b31f101`
**Certified tag:** `hoa-connect-sprint-01-foundation-certified-v1.0.0`

**Authorization:** Wave 2.0 only. No resident functionality, no migration, no SQL
object, no Edge Function, no frontend change, and no business test was produced.

---

## 1. Purpose

Wave 2.0 delivers no product behavior. Its entire output is (a) evidence that the
certified Sprint 1 baseline is intact, (b) the carry-forward integration that Sprint 1
deferred, and (c) the frozen engineering conventions that make waves 2.1–2.7
deterministic. Documents 35, 36 and 37 carry (c); this document carries (a) and (b).

---

## 2. Baseline verification

### 2.1 Certified tag resolves to the certified commit

```
$ git rev-list -n1 hoa-connect-sprint-01-foundation-certified-v1.0.0
a58a1ed98b0e5299678a41be833729895b31f101
```

Matches the certified baseline named in document 33 §7 exactly. **PASS.**

### 2.2 Nothing outside `docs/backend/` changed since certification

```
$ git diff --name-status a58a1ed HEAD
A docs/backend/27-sprint-02-executive-planning.md
A docs/backend/28-sprint-02-domain-model.md
A docs/backend/29-sprint-02-authorization-rls-blueprint.md
A docs/backend/30-sprint-02-edge-function-contract-plan.md
A docs/backend/31-sprint-02-validation-certification-plan.md
A docs/backend/32-sprint-02-executive-decision-review.md
A docs/backend/33-sprint-02-planning-remediation-matrix.md
 7 files changed, 5169 insertions(+)
```

Seven additions, zero modifications, zero deletions. No migration, Edge Function,
validation artifact, test, or frontend file differs from the certified commit.
The planning package (27–33) is present and corresponds to this repository. **PASS.**

This is the strongest available form of the "Sprint 1 remains unchanged" claim: it is a
statement about the whole tree, not a spot check of protected assets.

### 2.3 The certified baseline still passes its own gates

`npm run supabase:test:all` executed against the running local stack, at entry HEAD,
before any Wave 2.0 edit:

| Step | Result |
|---|---|
| `supabase:test:sprint1` (foundation SQL) | completed, no assertion raised |
| `supabase:test:edge-func-auth` | **35/35 passed (0 failed)** |
| `supabase:test:d2` (D2 SQL + ADR-09/10 runtime probe) | `"failures": []` |
| `supabase:test:sprint1` (post-D2 regression re-run) | completed, no assertion raised |
| **Suite exit code** | **0** |

`node validation/adr11_finance_compatibility.mjs` executed separately: exit 0, every
case `"compatibility_result": "PASS"`.

Two lines in the transcript read `ERROR:  profile_contacts.verified_at is immutable via
self update` and `ERROR:  audit_events are immutable`. These are **expected
negative-path assertions** — the suite provokes a forbidden write and requires the
database to reject it. They are evidence of enforcement, not failures.

**PASS.** All 16 certified gates of report 26 remain in the regression path and green.

### 2.4 Certified evidence artifacts were preserved byte-for-byte

Running the suite regenerates `validation/evidence/sprint01_edge_function_authorization.json`.
The regenerated file differed from the certified one only in `generatedAt`, per-run
JWT `fingerprint` values, per-assertion `timestamp` values, and one generated
`auditId` — **no status, outcome, or result field changed**. This was verified by
diffing with those fields excluded.

Because that artifact is certified Sprint 1 evidence, it was **restored to its committed
state** rather than left overwritten:

```
$ git diff --quiet a58a1ed -- validation/evidence/sprint01_edge_function_authorization.json && echo IDENTICAL
IDENTICAL
```

Wave 2.0 therefore re-proved the baseline without mutating the record of the baseline.
This is a deliberate discipline and is carried forward as a convention
(document 35 §6.3): **re-running a certified suite must never rewrite certified
evidence; new evidence goes to a new `sprint02_*` artifact.**

### 2.5 Post-integration re-verification

After the CF-01/CF-03 changes, the canonical suite was run again end to end:

```
> supabase:test:sprint1 → supabase:test:edge-func-auth → supabase:test:d2
  → supabase:test:adr11 → supabase:check:namespace → supabase:test:sprint1
CANONICAL SUITE EXIT=0
  === Results: 35/35 passed (0 failed) ===
  === namespace guard PASS ===
```

`npm run typecheck` exit 0. `npm run build` exit 0 (built in 2.37s).

---

## 3. Carry-forward integration (CF-01 … CF-05)

Dispositions follow document 27 §11 unchanged. Document 33 §4 confirms
"CF-01…CF-05 dispositions unchanged. CF-05 expanded in scope (RM-11), not redefined."

### CF-01 — ADR-11 canonical suite integration — **IMPLEMENTED**

Planned disposition: "integrate in Wave 2.0. Add `supabase:test:adr11` script invoking
`node validation/adr11_finance_compatibility.mjs` and chain it into `supabase:test:all`
after the D2 step. No test logic change."

Executed exactly as planned. `package.json` gains one script and one chained step; the
ADR-11 validator itself is **unmodified**. The script supplies the four environment
variables the validator reads, resolved from `supabase status -o env`, matching the
pattern already used by `validation/run_d2_regression.sh`.

Placement: after `supabase:test:d2` and **before** the closing
`supabase:test:sprint1` regression re-run. This satisfies "after the D2 step" and is
strictly stronger than appending at the end — the final Sprint 1 re-run now also proves
that the ADR-11 run left the certified baseline undisturbed.

Verified: the six steps execute in declared order with suite exit 0 (§2.5).

### CF-02 — D2 realtime publication cleanup — **NO-OP, EVIDENCE-BACKED**

Planned disposition: "evaluate in Wave 2.0; default NO-OP … cleanup only if the Sprint 2
certification requires a pristine publication diff. Document the decision; do not
implement speculatively."

Evaluated against the live database:

```sql
SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';
 public | d2_notifications
 public | d2_support_messages
(2 rows)
```

Three facts decide this:

1. **The residue is bounded and cannot grow.** `validation/d2_setup.sql:730-748`
   conditionally drops each table from the publication if already present, then
   line 749 re-adds exactly the two:
   `ALTER PUBLICATION supabase_realtime ADD TABLE public.d2_notifications, public.d2_support_messages;`
   The block is idempotent by construction, so repeated suite runs cannot accumulate
   members.
2. **No product table is affected.** The publication contains those two tables and
   nothing else. Removing them changes no product behavior because no product table is
   published; adding a cleanup step would only change local test-harness state.
3. **The residue is local-only and disposable.** It exists in the developer's local
   stack, is recreated by the D2 suite on demand, and is erased by `supabase db reset`.
   It is not in the repository and not in any environment that will ever serve traffic.

**Decision: NO-OP confirmed, not deferred.** Cleanup would add a mutation to the
certified validation path in exchange for zero behavioral benefit — the wrong trade at
this stage. The condition that would reverse this decision is named and testable:
*if Wave 2.6 or 2.7 certification requires a pristine `pg_publication_tables` diff, the
cleanup becomes a Wave 2.6 item*, implemented as a teardown in the D2 suite rather than
as a manual step. Recorded as such in document 36 §5.

### CF-03 — `d2_` namespace ownership guard — **IMPLEMENTED**

Planned disposition: "lightweight guard in Wave 2.0. A header-comment convention + a
CI-style grep check (`validation/` script asserting no non-`d2_` object adopts the
prefix and no product object is named `d2_*`). No runtime guard (would add trigger
overhead to the certified DB)."

Delivered as `validation/check_d2_namespace.sh`, chained into `supabase:test:all` as
`supabase:check:namespace`. It enforces three rules statically, over the checked-in
source tree only — **no database connection, no fixtures, no runtime state** — so it
cannot perturb the certified baseline and is safe in any suite position. No runtime
guard was added, as specified.

| Rule | Assertion |
|---|---|
| R1 | No `d2_` identifier appears anywhere under `supabase/` |
| R2 | No product object is named `d2_*` (structural: all product objects live under `supabase/`) |
| R3 | The unprefixed test-role set is exactly the four CF-04 roles |

Current result: **PASS** on all three.

**The guard was negative-tested**, because a guard that cannot fail proves nothing:

| Injected violation | Guard result |
|---|---|
| A file under `supabase/tests/` containing the token `d2_` | **FAIL (R1/R2)**, offending file:line reported |
| A fifth unprefixed role added to `validation/d2_setup.sql` | **FAIL (R3)**, expected-vs-actual sets printed |
| Both probes reverted | **PASS**, working tree clean |

### CF-04 — Unprefixed cluster-global test roles — **DEFERRED AS PLANNED, NOW ENFORCED**

Planned disposition: "defer rename; document in Wave 2.0 … Interim: CF-03 grep check
asserts the four names remain the only unprefixed test roles."

The four roles are confirmed present at
`validation/d2_setup.sql:39,43,47,51` — `profile_read_test`,
`profile_self_update_test`, `operator_contact_test`, `platform_admin_test`.

The rename remains deferred (it touches certified D2 evidence; scheduled alongside the
next D2 suite revision, Sprint 3 at the latest, per document 27 §11 and the D-15
accepted-debt register). The interim control is now **executable rather than
documentary**: CF-03 rule R3 fails the canonical suite if a fifth unprefixed role
appears or one of the four disappears. Wave 2.0 converted a written intention into a
gate.

### CF-05 — Documentation verification discipline — **ACTIVE, APPLIED TO THIS WAVE**

Active process rule for all Sprint 2 documents, expanded by RM-11 (document 27 §14.1)
from reports to every package document, with six rules including a file:line citation
requirement and an auditor hook.

Documents 34–37 comply. The verification record is §6 of this document, and the rule is
restated as a standing convention in document 35 §6.

---

## 4. Engineering infrastructure

Scope item 3 asked for folder, documentation, test, validation and execution
organization. **One judgment call is recorded here explicitly.**

The approved plan specifies Sprint 2 test artifacts as flat, prefixed files —
`supabase/tests/sprint02_*.sql`, `supabase/tests/sprint02_edge_function_*.mjs`,
`supabase/tests/sprint02_performance_*.sql` (document 27 §9, waves 2.1/2.4b/2.5/2.6) —
mirroring the certified Sprint 1 layout (`supabase/tests/sprint01_foundation.sql`,
`sprint01_edge_function_auth.test.mjs`, `sprint01_performance_seed.sql`,
`sprint01_performance_explain.sql`).

Creating `supabase/tests/sprint02/` subdirectories would have **contradicted the
approved plan** for the sake of appearing to produce structure. It was not done.
"Test organization" is therefore delivered as *documented naming conventions*
(document 35 §5) rather than as empty directories — which also avoids committing
placeholder files that carry no information.

Concretely, Wave 2.0 created **one** executable artifact
(`validation/check_d2_namespace.sh`) and **no** new directories. Everything else in
scope item 3 is convention, and conventions live in document 35 where waves 2.1–2.7
will actually read them.

---

## 5. Source control

| Item | Value |
|---|---|
| Entry HEAD | `6f0399232515cdfec80f54d7705906715b294387` |
| Branch | `sprint-01-foundation-identity` |
| Commits created | **none** — changes left in the working tree pending review |
| Push / merge / tag | **none** |
| Migrations, SQL objects, Edge Functions, frontend, business tests | **none** |

**Files created (4 documents + 1 guard):**

```
docs/backend/34-wave-20-foundation-report.md
docs/backend/35-wave-20-engineering-conventions.md
docs/backend/36-wave-20-governance-checklist.md
docs/backend/37-wave-20-execution-roadmap.md
validation/check_d2_namespace.sh
```

**Files modified (1):**

```
package.json    (+2 scripts: supabase:test:adr11, supabase:check:namespace;
                 supabase:test:all chain extended by those 2 steps)
```

**Files explicitly restored / left untouched:**

```
validation/evidence/sprint01_edge_function_authorization.json   (restored, §2.4)
supabase/migrations/                                            (untouched)
supabase/functions/                                             (untouched)
supabase/tests/                                                 (untouched)
validation/*.sql, validation/*.mjs                              (untouched)
src/                                                            (untouched)
docs/backend/01…33                                              (untouched)
```

`package.json` is the only non-documentation file modified in the entire wave, and the
change is additive: no existing script's behavior was altered, and
`supabase:test:sprint1`, `supabase:test:edge-func-auth` and `supabase:test:d2` are
byte-identical to the certified versions.

---

## 6. CF-05 verification record for this document

| Claim | Verification |
|---|---|
| Tag → `a58a1ed…` | `git rev-list -n1` output, §2.1 |
| Only docs changed since certification | `git diff --name-status a58a1ed HEAD`, §2.2 |
| 35/35 EF-auth gates | suite transcript, §2.3 |
| ADR-11 passes | `node validation/adr11_finance_compatibility.mjs` exit 0, §2.3 |
| Publication holds exactly 2 `d2_` tables | `pg_publication_tables` query, CF-02 |
| Publication add is idempotent | `validation/d2_setup.sql:730-749`, read directly |
| Four unprefixed roles | `validation/d2_setup.sql:39,43,47,51`, grep output |
| `residence_members` indexes are plain composite, not partial (RM-09) | `supabase/migrations/20260719170000_sprint01_foundation_identity.sql:214-215` read directly — `(profile_id, status)` and `(property_id, status)`, no `WHERE` clause. **RM-09's correction is confirmed accurate** |
| Sprint 2 test files are flat-prefixed | document 27 §9; `ls supabase/tests/` |
| Guard detects violations | two injected-violation probes, CF-03 |

No claim in this document is uncited. No runtime claim is made that was not observed in
this wave's own transcripts.

---

## 7. Residual risks

Wave 2.0 opens no new technical risk. It carries forward those already accepted:

1. **The frozen list must stay frozen (GOVERNANCE, document 33 §5 item 2).** Unchanged
   by this wave and unenforceable by it. Document 36 §2 converts it into a signed entry
   gate for Wave 2.1 — the strongest control available without executive action.
2. **CF-04 rename still outstanding (LOW).** Deferred by plan; now gated against drift
   rather than merely documented.
3. **CF-02 residue persists in local stacks (COSMETIC).** Accepted with a named
   reversal condition (document 36 §5).
4. **Local-stack evidence is not a production benchmark.** Sprint 1 precedent; restated
   in document 35 §7 so no future wave mistakes an EXPLAIN transcript for a benchmark.
5. **Out-of-band invitation token delivery (MEDIUM, accepted)** and the **`profiles`
   policy extension touching a certified object (LOW-MEDIUM)** remain the executive's
   to carry (document 33 §5). Neither is touched by Wave 2.0; both bind Wave 2.4/2.5.

---

## 8. Wave 2.0 exit criteria

Against document 27 §9 Wave 2.0:

| Criterion | Status |
|---|---|
| Entry: working tree clean at certified commit | **MET** — clean at entry HEAD; the only delta from certified is the approved planning package |
| Canonical suite including ADR-11 passes | **MET** — §2.5, exit 0 |
| Baseline diff audit shows only CF-scoped changes | **MET** — `package.json` (CF-01/CF-03) + one new guard script + four documents |
| Tests: `supabase:test:all` + ADR-11, typecheck, build | **MET** — all exit 0 |
| Audit evidence stored | **MET** — transcripts summarized in §2; certified evidence preserved unmodified per §2.4 |
| Rollback available | **MET** — `git checkout -- package.json && rm validation/check_d2_namespace.sh` restores the certified toolchain exactly; no database object was created, so no database rollback exists to perform |

---

## 9. Verdict

Sprint 1 certification is preserved and re-proved. The planning package corresponds to
this repository. All five carry-forwards are integrated — three implemented, one
deliberately no-oped with evidence, one deferred by plan and now gated. Engineering
conventions, governance rules and the execution roadmap are frozen in documents 35–37.

The repository is ready for Wave 2.1, subject to the one sequencing condition already in
the plan and restated in document 36 §2: **the frozen list of certified-object changes
(document 28 §12) must be signed off before Wave 2.1 begins.** That signature is an
executive act; Wave 2.0 cannot supply it and does not claim to.
