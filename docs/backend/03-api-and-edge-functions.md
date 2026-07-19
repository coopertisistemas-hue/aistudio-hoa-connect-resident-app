# 03 — API Catalog & Edge Function Catalog

> Deliverables 4 and 5. Every operation the certified frontend performs, mapped to an endpoint.
>
> **The frontend exports 60 demo-service functions; 52 of them are production-relevant operations**
> that must be served by a live Edge Function. The remaining 8 are client-side utilities, static
> catalogs, session operations, or demo-only controls. Nothing here is speculative; every row traces
> to an exported function in `src/demo/*.ts` that a certified screen already calls.

**July 19, 2026 implementation update:** Sprint 1 delivers the identity foundation functions only: `auth-bootstrap`, `auth-context`, `profile-get`, `profile-update`, `profile-contacts-list`, `profile-contact-upsert`, `profile-contact-delete`, `tenant-context-list`, `tenant-context-select`, and `resident-auth`. They establish the backend boundary and response envelope for later service replacements; they do not yet complete the full resident service catalog above.

---

## 1. Service topology

Nine resident-facing functions, grouped by aggregate rather than by screen. Screens compose;
functions own domains.

| Function | Domain | Replaces demo service | Ops | Non-backend (client-side / static / demo-only) |
|---|---|---|:---:|:---:|
| `resident-auth` | login, first access, recovery, session | (login page, inline) | 7 | 0 |
| `resident-profile` | identity, contacts, preferences, security, corrections | `profileService.ts` | 17 | 5 (`fetchPrivacySections`, `fetchPrivacyDataCategories`, `fetchAboutInfo`, `fetchDeviceAppInfo`, `performSignOut`¹) |
| `resident-residences` | residence context, detail, water service, linked people | `residenceService.ts` | 7 | 0 |
| `resident-home` | home aggregate | `homeService.ts` | 1 | 0 |
| `resident-consumption` | consumption, readings, divergence | `consumoService.ts` | 3 | 0 |
| `resident-finance` | invoices, documents, payments, receipts, disputes | `financeService.ts` | 8 | 0 |
| `resident-communication` | notifications, notices, preferences | `notificationService.ts` | 11 | 1 (`resetNotificationState`, demo-only) |
| `resident-support` | requests, messages, visits, ratings, FAQ | `supportService.ts` | 13 | 2 (`fetchFAQ`, `getSupportCategoryOptions`, static catalogs) |
| `resident-uploads` | signed upload/download URLs | (n/a — new capability) | 2 | 0 |
| **Total** | | | **60** | **8** |

¹ `performSignOut` is a session operation still served by `resident-auth`; it is classified separately in the canonical inventory (see §4).

Routing is path-based within each function (the pattern the existing fleet already uses):
`POST /functions/v1/resident-finance/invoices/{id}/boleto`.

### Why nine functions and not fifty-two

Supabase Edge Functions have per-function cold-start cost. Fifty-two single-purpose production functions would
multiply cold starts and deployment surface for no isolation benefit — these all share the same
auth, tenant, and scope middleware. Grouping by aggregate also keeps a domain's invariants inside
one deployable unit, which is what makes "business rules belong inside Edge Functions" actually
hold: an invariant split across two functions is an invariant enforced by neither. The nine
functions cover 60 exported demo functions, of which 52 are production-relevant.

---

## 2. Shared middleware

Every request passes the same pipeline, in order:

```
1. verify_jwt (gateway)          → 401
2. auth.getUser (in-function)    → 401     re-verification; existing fleet already does this
3. resolveProfile(user_id)       → 403     profiles row must exist and be active
4. resolveTenant(profile, hdr)   → 403     multi-membership + X-Tenant-Id (uses _shared/tenant.ts)
5. resolveResidenceScope(id)     → 403     ACTIVE residence_members row REQUIRED  ← the resident gate
6. zod validate body/query       → 422
7. checkIdempotency(header)      → replay original response if key seen (ADR-08)
8. handler                                 business rules live here
9. audit + system_event emit
10. envelope response
```

**Step 5 is the resident authorization boundary and it is not optional on any residence-scoped
endpoint.** The audit found `meter-readings-api` accepts `water_meter_id` from the request body
with no ownership validation (HIGH-02) — using a service-role client, which bypasses RLS. That is
the exact failure this step exists to prevent. Any new endpoint that reads a residence-scoped
resource without step 5 is a cross-tenant data leak.

---

## 3. API Catalog

Conventions: all paths relative to `/functions/v1/`. `⚡` = realtime-backed. `🔑` = requires
`Idempotency-Key`. Response column names the **canonical DTO**; the frontend type is produced by
the assembler (ADR-03).

---

### 3.1 `resident-auth`

| # | Method / Path | Purpose | Canonical response | Notes |
|---|---|---|---|---|
| 1 | `POST /login` | CPF or email + password | `SessionDTO` | GoTrue; CPF resolved to email server-side |
| 2 | `POST /first-access/verify` | Validate CPF + birth date against a `residents` record | `FirstAccessChallengeDTO` | Rate-limited; **must not disclose whether the CPF exists** |
| 3 | `POST /first-access/confirm` | Send verification code to registered contact | `{ maskedTarget }` | |
| 4 | `POST /first-access/activate` 🔑 | Code + password → create `auth.users` + `profiles` + link `residence_members` | `SessionDTO` | Atomic; the single most security-sensitive endpoint |
| 5 | `POST /password-recovery/request` | Initiate reset | `{ maskedTarget }` | **Always 200**, regardless of account existence |
| 6 | `POST /password-recovery/confirm` | Code + new password | `SessionDTO` | |
| 7 | `POST /logout` | Current device or all devices | `SignOutResultDTO` | `SignOutType` |

**First access is the highest-risk flow in the program.** It converts knowledge of a CPF and birth
date — both semi-public in Brazil — into control of an account that can see an association's
billing for a residence. Required controls: strict rate limiting per CPF *and* per IP, generic
responses that never confirm whether a CPF is registered, codes delivered only to the contact
already on file (never to a caller-supplied address), short code TTL, and an `audit_logs` entry on
every attempt. This must be threat-modelled before implementation, not after.

---

### 3.2 `resident-profile` — replaces `profileService.ts` (17 demo ops + 1 new photo endpoint)

| # | Method / Path | Demo fn | Notes |
|---|---|---|---|
| 8 | `GET /overview` | `fetchProfileOverview` | Aggregate: profile, contacts, residences, invitations, prefs, security |
| 9 | `PATCH /profile` | `performProfileEdit` | **Only** `preferredName`, `displayName`, `pronounPreference`. Server rejects protected fields |
| 10 | `PATCH /contacts/{type}` | `performContactEdit` | Sets state to `pending`, triggers verification |
| 11 | `POST /contacts/{type}/verify` 🔑 | `performContactVerification` | Code confirmation |
| 12 | `POST /corrections` 🔑 | `performCorrectionRequest` | Issues `COR-` protocol; opens support request |
| 13 | `PATCH /preferences/{id}` | `performAppPreferenceSave` | |
| 14 | `PATCH /accessibility/{id}` | `performAccessibilitySave` | |
| 15 | `POST /password` | `performPasswordChange` | Requires current password; invalidates other sessions |
| 16 | `GET /security` | (in overview) | Devices, session lock, recovery email |
| 17 | `DELETE /devices/{id}` | `performRemoveDevice` | See `profile_devices` caveat (Doc 02 §3.6) |
| 18 | `POST /invitations/{id}/accept` 🔑 | `performAcceptInvitation` | Creates `residence_members` row |
| 19 | `POST /invitations/{id}/decline` | `performDeclineInvitation` | |
| 20 | `PUT /active-residence` | `performSetActiveResidence` | Sets `is_primary` |
| 21 | `GET /privacy` | `fetchPrivacySections` | **Static i18n — no backend call** |
| 22 | `GET /privacy/categories` | `fetchPrivacyDataCategories` | **Static i18n** |
| 23 | `GET /about` | `fetchAboutInfo` | **Static i18n** + build metadata |
| 24 | `GET /device-info` | `fetchDeviceAppInfo` | **Client-derived** |
| 25 | `POST /photo` | (new) | Signed upload → `profiles.photo_path` |

Ops 21–24 resolve entirely client-side. They are listed for completeness of the migration
inventory, and to record that they intentionally have **no** endpoint.

---

### 3.3 `resident-residences` — replaces `residenceService.ts` (7 ops)

| # | Path | Demo fn |
|---|---|---|
| 26 | `GET /contexts` | `fetchResidenceContexts` |
| 27 | `GET /{id}` | `fetchResidenceDetail` |
| 28 | `GET /{id}/water-service` | `fetchWaterServiceInfo` |
| 29 | `GET /{id}/residents` | `fetchLinkedResidents` |
| 30 | `GET /{id}/contact-preferences` | `fetchContactPreferences` |
| 31 | `GET /association` | `fetchAssociationInfo` |
| 32 | `GET /{id}/documents` | `fetchPropertyDocuments` |

Op 29 returns **minimal** co-resident data — first name, initials, relationship, status. Not
documents, not contacts. Co-residents are not entitled to each other's PII merely by sharing an
address; the certified UX already renders only these fields, and the API must not exceed them.
(This is the resident-side analogue of audit finding MEDIUM-01, where `association-api GET /members`
returns every member's email to every role.)

---

### 3.4 `resident-home` — replaces `homeService.ts` (1 op)

| # | Path | Demo fn |
|---|---|---|
| 33 | `GET /overview?residenceId=` | `fetchHomeOverview` |

Composes `PrimaryStatus`, `ConsumptionPreview`, `NoticePreview`, `SupportPreview`, `RecentActivity`.

**Deliberately a single aggregate call, not five.** Home is the app's cold-start screen; five
round trips would multiply latency against the < 200ms p95 target. Internally the handler fans out
in parallel and **degrades per-section**: if consumption fails, `consumptionPreview.available =
false` and the rest still renders. The certified UX already handles exactly this — every preview
card has an unavailable state. Failing the whole screen because one section failed would be a
regression against certified behaviour.

`PrimaryStatus.type` is a **server-computed business decision** (which of six states the resident
is in, in priority order). It must not be inferred client-side from an invoice list — two clients
would inevitably diverge on precedence.

---

### 3.5 `resident-consumption` — replaces `consumoService.ts` (3 ops)

| # | Path | Demo fn | Notes |
|---|---|---|---|
| 34 | `GET /overview?residenceId=` | `fetchConsumptionOverview` | Current period, meter, history, insights, alerts |
| 35 | `GET /readings?residenceId=` | `fetchReadingHistory` | Paginated |
| 36 | `GET /readings/{id}` | `fetchReadingDetail` | Includes revision history |
| 37 | `POST /divergences` 🔑 | (`DivergenceFlow`) | Issues `DIV-` protocol; opens support request |

Classification (`dentro_do_esperado`, `abaixo_do_habitual`, `acima_do_habitual`,
`atencao_recomendada`, `leitura_indisponivel`, `dados_em_revisao`), `usualRange`, `interpretation`,
insights, and alerts are **all computed server-side** from `consumption_baselines`. The client
receives the enum and derives only the label.

This matters beyond architecture: consumption classification is the basis on which a resident may
dispute a bill. It must be reproducible, auditable, and identical for every client — which means
it can only live in one place.

---

### 3.6 `resident-finance` — replaces `financeService.ts` (8 ops)

| # | Path | Demo fn | Notes |
|---|---|---|---|
| 38 | `GET /overview?residenceId=` | `fetchFinancialOverview` | Account status, next due, overdue, YTD paid, invoices, payments |
| 39 | `GET /invoices/{id}` | `fetchInvoiceDetail` | With line items |
| 40 | `GET /invoices/{id}/boleto` | `fetchBoletoInfo` | 503 → `DOCUMENT_ERROR` |
| 41 | `GET /invoices/{id}/pix` | `fetchPixInfo` | 503 → `DOCUMENT_ERROR` |
| 42 | `GET /payments?residenceId=` | `fetchPaymentHistory` | |
| 43 | `GET /payments/{id}` | `fetchPaymentDetail` | |
| 44 | `GET /payments/{id}/receipt` | `fetchReceiptData` | |
| 45 | `POST /disputes` 🔑 | (`UnrecognizedPaymentFlow`) | Issues `PAG-` protocol |

**The Resident App has no write access to the financial ledger.** Ops 38–44 are strictly read-only;
op 45 creates a *dispute*, never a payment. No resident endpoint touches `payments`,
`billing_titles`, `receivables`, `tariff_plans`, or `bank_agreements`. Under ADR-07 this is
enforced structurally rather than by convention.

`AccountStatus` is server-computed with the same precedence argument as `PrimaryStatus`.

---

### 3.7 `resident-communication` — replaces `notificationService.ts` (11 ops)

| # | Path | Demo fn | Notes |
|---|---|---|---|
| 46 | `GET /overview?residenceId=` | `fetchNotificationOverview` | ⚡ |
| 47 | `GET /notifications/{id}` | `fetchNotificationDetail` | |
| 48 | `GET /notices/{id}` | `fetchNoticeDetail` | |
| 49 | `POST /notifications/{id}/read` | `performMarkAsRead` | |
| 50 | `POST /notifications/{id}/unread` | `performMarkAsUnread` | |
| 51 | `POST /notifications/read-all` | `performMarkAllAsRead` | |
| 52 | `POST /notices/{id}/read` | `performMarkNoticeRead` | |
| 53 | `POST /notices/{id}/unread` | `performMarkNoticeUnread` | |
| 54 | `GET /preferences` | `fetchPreferences` | |
| 55 | `PUT /preferences` | `savePreferences` | Rejects disabling `mandatory` categories |
| 56 | `GET /notifications?filter=&cursor=` | (list in overview) | Cursor pagination for `many_unread` |

---

### 3.8 `resident-support` — replaces `supportService.ts` (13 ops)

| # | Path | Demo fn | Notes |
|---|---|---|---|
| 57 | `GET /overview?residenceId=` | `fetchSupportOverview` | ⚡ |
| 58 | `GET /requests?status=&residenceId=` | `fetchRequestList` | |
| 59 | `GET /requests/{id}` | `fetchRequestDetail` | Timeline, messages, visit, rating, eligible actions |
| 60 | `POST /requests` 🔑 | `performNewRequest` | Issues `SUP-` protocol |
| 61 | `POST /requests/{id}/messages` 🔑 | `performReply` | ⚡ |
| 62 | `POST /requests/{id}/cancel` | `performCancelRequest` | |
| 63 | `POST /requests/{id}/close` | `performCloseRequest` | |
| 64 | `POST /requests/{id}/reopen` | `performReopenRequest` | Eligibility window is server-enforced |
| 65 | `POST /requests/{id}/rating` 🔑 | `performRating` | One per request |
| 66 | `POST /requests/{id}/visit/confirm` | `performConfirmVisit` | |
| 67 | `GET /faq` · `GET /contact-info` | `fetchFAQ`, `fetchContactInfo` | Mostly static i18n + `tenants.settings` |

Every state-changing op (62–66) **re-validates eligibility server-side** against the same rules
that produced `eligibleActions[]`. A client that receives an action in its list and a client that
fabricates one must be treated identically — the list is a UI convenience, not the authorization.

---

### 3.9 `resident-uploads`

| # | Path | Purpose |
|---|---|---|
| 68 | `POST /signed-upload` | Returns a short-TTL signed URL. Validates MIME, size, quota, and destination path prefix |
| 69 | `POST /signed-download` | Short-TTL signed URL for an object the caller is scoped to |

Clients never hold storage credentials and never construct object paths. See Doc 05.

---

## 4. Canonical operation inventory

Every exported function in `src/demo/*.ts` is classified below. The migration gate requires:

- every **production-relevant** operation mapped to an Edge Function path;
- every **demo-only** operation explicitly excluded;
- every **static catalog** assigned an ownership model (i18n or `tenants.settings`);
- every **session operation** assigned to `resident-auth`;
- no orphan operation.

### 4.1 Classification summary

| Class | Count | Notes |
|---|---|---|
| Production API operation | **52** | Served by the nine resident-facing Edge Functions |
| Local UI utility | 1 | `fetchDeviceAppInfo` — client-derived, no backend call |
| Static catalog | 5 | `fetchPrivacySections`, `fetchPrivacyDataCategories`, `fetchAboutInfo`, `fetchFAQ`, `getSupportCategoryOptions` |
| Demo-only reset | 1 | `resetNotificationState` — test harness only |
| Session operation | 1 | `performSignOut` — served by `resident-auth` |
| Retired / no backend | 0 | — |
| **Total exported functions** | **60** | |

### 4.2 Detailed inventory

**`financeService.ts` — 8 production API operations**

| # | Function | Edge Function path | Notes |
|---|---|---|---|
| 1 | `fetchFinancialOverview` | `GET /resident-finance/overview` | |
| 2 | `fetchInvoiceDetail` | `GET /resident-finance/invoices/{id}` | |
| 3 | `fetchBoletoInfo` | `GET /resident-finance/invoices/{id}/boleto` | Document-unavailable returned as DTO field, not thrown |
| 4 | `fetchPixInfo` | `GET /resident-finance/invoices/{id}/pix` | Same as boleto |
| 5 | `fetchPaymentHistory` | `GET /resident-finance/payments` | |
| 6 | `fetchPaymentDetail` | `GET /resident-finance/payments/{id}` | |
| 7 | `fetchReceiptData` | `GET /resident-finance/payments/{id}/receipt` | |
| 8 | *(dispute flow)* | `POST /resident-finance/disputes` | Triggered by `UnrecognizedPaymentFlow`; no exported demo fn of this name |

**`profileService.ts` — 12 production, 1 session, 4 non-backend**

| # | Function | Class | Edge Function path / disposition |
|---|---|---|---|
| 1 | `fetchProfileOverview` | Production | `GET /resident-profile/overview` |
| 2 | `performProfileEdit` | Production | `PATCH /resident-profile/profile` |
| 3 | `performContactEdit` | Production | `PATCH /resident-profile/contacts/{type}` |
| 4 | `performContactVerification` | Production | `POST /resident-profile/contacts/{type}/verify` |
| 5 | `performCorrectionRequest` | Production | `POST /resident-profile/corrections` |
| 6 | `performAppPreferenceSave` | Production | `PATCH /resident-profile/preferences/{id}` |
| 7 | `performAccessibilitySave` | Production | `PATCH /resident-profile/accessibility/{id}` |
| 8 | `performPasswordChange` | Production | `POST /resident-profile/password` |
| 9 | `performRemoveDevice` | Production | `DELETE /resident-profile/devices/{id}` |
| 10 | `performAcceptInvitation` | Production | `POST /resident-profile/invitations/{id}/accept` |
| 11 | `performDeclineInvitation` | Production | `POST /resident-profile/invitations/{id}/decline` |
| 12 | `performSetActiveResidence` | Production | `PUT /resident-profile/active-residence` |
| 13 | `performSignOut` | Session | `POST /resident-auth/logout` |
| 14 | `fetchPrivacySections` | Static catalog | i18n / `tenants.settings` — no backend call |
| 15 | `fetchPrivacyDataCategories` | Static catalog | i18n / `tenants.settings` — no backend call |
| 16 | `fetchAboutInfo` | Static catalog | i18n + build metadata — no backend call |
| 17 | `fetchDeviceAppInfo` | Local UI utility | Client-derived — no backend call |

**`residenceService.ts` — 7 production API operations**

| # | Function | Edge Function path |
|---|---|---|
| 1 | `fetchResidenceContexts` | `GET /resident-residences/contexts` |
| 2 | `fetchResidenceDetail` | `GET /resident-residences/{id}` |
| 3 | `fetchWaterServiceInfo` | `GET /resident-residences/{id}/water-service` |
| 4 | `fetchLinkedResidents` | `GET /resident-residences/{id}/residents` |
| 5 | `fetchContactPreferences` | `GET /resident-residences/{id}/contact-preferences` |
| 6 | `fetchAssociationInfo` | `GET /resident-residences/association` |
| 7 | `fetchPropertyDocuments` | `GET /resident-residences/{id}/documents` |

**`homeService.ts` — 1 production API operation**

| # | Function | Edge Function path |
|---|---|---|
| 1 | `fetchHomeOverview` | `GET /resident-home/overview` |

**`consumoService.ts` — 3 production API operations**

| # | Function | Edge Function path |
|---|---|---|
| 1 | `fetchConsumptionOverview` | `GET /resident-consumption/overview` |
| 2 | `fetchReadingHistory` | `GET /resident-consumption/readings` |
| 3 | `fetchReadingDetail` | `GET /resident-consumption/readings/{id}` |

**`notificationService.ts` — 10 production, 1 demo-only reset**

| # | Function | Class | Edge Function path / disposition |
|---|---|---|---|
| 1 | `fetchNotificationOverview` | Production | `GET /resident-communication/overview` |
| 2 | `fetchNotificationDetail` | Production | `GET /resident-communication/notifications/{id}` |
| 3 | `fetchNoticeDetail` | Production | `GET /resident-communication/notices/{id}` |
| 4 | `performMarkAsRead` | Production | `POST /resident-communication/notifications/{id}/read` |
| 5 | `performMarkAsUnread` | Production | `POST /resident-communication/notifications/{id}/unread` |
| 6 | `performMarkAllAsRead` | Production | `POST /resident-communication/notifications/read-all` |
| 7 | `performMarkNoticeRead` | Production | `POST /resident-communication/notices/{id}/read` |
| 8 | `performMarkNoticeUnread` | Production | `POST /resident-communication/notices/{id}/unread` |
| 9 | `fetchPreferences` | Production | `GET /resident-communication/preferences` |
| 10 | `savePreferences` | Production | `PUT /resident-communication/preferences` |
| 11 | `resetNotificationState` | Demo-only reset | Test harness only; no production endpoint |

**`supportService.ts` — 11 production, 2 static catalogs**

| # | Function | Class | Edge Function path / disposition |
|---|---|---|---|
| 1 | `fetchSupportOverview` | Production | `GET /resident-support/overview` |
| 2 | `fetchRequestList` | Production | `GET /resident-support/requests` |
| 3 | `fetchRequestDetail` | Production | `GET /resident-support/requests/{id}` |
| 4 | `performNewRequest` | Production | `POST /resident-support/requests` |
| 5 | `performReply` | Production | `POST /resident-support/requests/{id}/messages` |
| 6 | `performCancelRequest` | Production | `POST /resident-support/requests/{id}/cancel` |
| 7 | `performCloseRequest` | Production | `POST /resident-support/requests/{id}/close` |
| 8 | `performReopenRequest` | Production | `POST /resident-support/requests/{id}/reopen` |
| 9 | `performRating` | Production | `POST /resident-support/requests/{id}/rating` |
| 10 | `performConfirmVisit` | Production | `POST /resident-support/requests/{id}/visit/confirm` |
| 11 | `fetchContactInfo` | Production | `GET /resident-support/contact-info` |
| 12 | `fetchFAQ` | Static catalog | i18n / `tenants.settings` — no backend call |
| 13 | `getSupportCategoryOptions` | Static catalog | i18n-backed enum — no backend call |

### 4.3 Reconciled success criterion

> Every one of the **52 production-relevant demo-service operations** is served by a live Edge Function.

The original unqualified "60 operations" is removed from the success criterion.

---

## 5. Edge Function Catalog — existing fleet

### 5.1 Deployed (11) — Admin-owned, all `verify_jwt=true`

| Function | v | Resident App impact |
|---|---|---|
| `association-api` | 2 | **Reuse read-only** for association profile. `GET /members` leaks all member emails to any role (MEDIUM-01) — must not be reachable by residents |
| `residents-api` | 4 | **Do not expose.** Any role reads full PII of all tenant residents |
| `properties-api` | 3 | Not exposed; resident residence data comes from `resident-residences` with scope enforcement |
| `water-meters-api` | 3 | Not exposed |
| `meter-readings-api` | 3 | **Do not extend.** HIGH-02: admin-only writes, client-supplied `previous_reading`, no tenant validation on `water_meter_id`, no idempotency. Collector program replaces it |
| `tickets-api` | 2 | Left for Admin. Superseded for residents by `resident-support` (ADR-06) |
| `billing-api` | 3 | Left for Admin. Note: frontend calls `POST /run-alerts`, **a route that does not exist server-side** |
| `payments-api` | 5 | Left for Admin. No idempotency (MEDIUM-07) |
| `receivables-api` | 3 | Left for Admin |
| `expenses-api` | 2 | No resident relevance |
| `bank-files-api` | 1 | No resident relevance; metadata registry only |

**None of the 11 are modified by this program.** All resident traffic goes to the nine new
functions. This is what keeps the Admin App's blast radius at zero.

### 5.2 In-repo, undeployed (4)

| Function | Disposition |
|---|---|
| `tenant-bootstrap` | Deploy when SaaS onboarding is in scope — not Phase 1 |
| `dashboard-api` | TODO placeholder. Superseded for residents by `resident-home` |
| `documents-api` | GET is real and tenant-scoped; POST is a 202 placeholder. **Complete and deploy in Sprint 4** — billing documents are on the Resident App's critical path |
| `bank-return-api` | Collector/Admin concern |

### 5.3 `_shared` modules — adopt, do not rewrite

`auth.ts`, `tenant.ts` (`resolveTenant` — multi-membership + `X-Tenant-Id`; **the correct model,
currently unused by every deployed function**), `permissions.ts`, `response.ts`, `errors.ts`,
`cors.ts`, `database.ts`, `audit.ts`.

Extensions needed: `scope.ts` (residence scope resolution), `idempotency.ts`, `protocol.ts`,
`validation.ts` (zod), and a CORS allow-list replacing `*`.

---

## 6. Contract freeze

Before Sprint 2 opens, the following are versioned and frozen:

1. **Canonical DTO schemas** — zod schemas, shared verbatim between Edge Function and client
   transport layer. One definition, two consumers; drift becomes a type error rather than a
   production bug.
2. **Error code registry** — every `error.code`, its HTTP status, and its i18n key.
3. **Assembler test vectors** — for each of the 7 modules, a canonical DTO fixture and the
   presentation object it must produce. These are written *against the existing demo fixtures*,
   so they can be validated before any backend exists.

Point 3 is what makes "never break the existing UX" verifiable rather than aspirational: if an
assembler produces an object structurally identical to the fixture the certified screens were
built against, the screens cannot regress.

---

**Next:** [04 — Authentication, Authorization & RLS](04-auth-and-authorization.md)
