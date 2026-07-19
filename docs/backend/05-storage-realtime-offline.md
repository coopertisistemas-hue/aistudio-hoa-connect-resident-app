# 05 — Storage, Realtime & Offline

> Deliverable 6 (Storage Architecture), plus the Realtime and Offline strategies.

---

## 1. Storage architecture

### 1.1 Current state

```
Buckets:  0        Objects: 0        Storage policies: 0
```

Verified. RLS is enabled on all 8 `storage` tables with **zero policies** — meaning storage is
currently fully locked and nothing is world-readable. That is the correct default and the good
news; the bad news is that six columns across the schema already point at files that cannot exist:

`meter_readings.image_url`, `expenses.receipt_url`, `billing_documents.file_url`,
`billing_titles.pdf_url`, `bank_files.file_url`, and every attachment the Resident App's support
and divergence flows accept.

Each is a plain `text` column holding a client-supplied string. Nothing validates that the value
points anywhere real, anywhere owned, or anywhere private.

### 1.2 Bucket design

All buckets **private**. No public bucket exists anywhere in this design — an association's
billing documents and a resident's uploaded receipts are never one guessed URL away from disclosure.

| Bucket | Contents | Path convention | Max | MIME |
|---|---|---|---|---|
| `billing-documents` | Boletos, receipts, statements | `{tenant_id}/titles/{title_id}/{doc_type}-{uuid}.pdf` | 10 MB | `application/pdf` |
| `support-attachments` | Resident + staff attachments | `{tenant_id}/support/{request_id}/{uuid}.{ext}` | 15 MB | jpeg, png, webp, heic, pdf |
| `meter-photos` | Collector field evidence | `{tenant_id}/meters/{meter_id}/{reading_id}.jpg` | 5 MB | jpeg, webp |
| `occurrence-photos` | Collector occurrence evidence | `{tenant_id}/occurrences/{occurrence_id}/{uuid}.jpg` | 5 MB | jpeg, webp |
| `profile-photos` | Avatars | `{tenant_id}/profiles/{profile_id}.{ext}` | 2 MB | jpeg, png, webp |
| `association-assets` | Logos, notice attachments | `{tenant_id}/assets/{uuid}.{ext}` | 10 MB | jpeg, png, webp, svg, pdf |
| `bank-files` | CNAB remittance/return | `{tenant_id}/cnab/{yyyy}/{mm}/{uuid}.{ext}` | 50 MB | text, ret, rem |

**Every path begins with `{tenant_id}`.** This makes tenant isolation a prefix comparison —
cheap enough to evaluate in a storage policy on every object access, and impossible to express
ambiguously. It is the same discipline the Collector audit recommended (§17).

### 1.3 Access pattern — signed URLs only

```
Client                    Edge Function                    Storage
  │  POST /signed-upload        │                             │
  │  {bucket, purpose, mime,    │                             │
  │   size, entityId}           │                             │
  ├────────────────────────────►│                             │
  │                             │ 1. authorize scope          │
  │                             │ 2. validate MIME + size     │
  │                             │ 3. CONSTRUCT the path ──────┤ client never supplies a path
  │                             │ 4. createSignedUploadUrl    │
  │◄────────────────────────────┤    (TTL 5 min)              │
  │                             │                             │
  ├─── PUT file ────────────────────────────────────────────► │
  │                             │                             │
  │  POST /confirm-upload       │                             │
  ├────────────────────────────►│ 5. verify object exists     │
  │                             │ 6. write DB row (path only) │
  │                             │ 7. queue virus scan         │
```

Non-negotiables:

1. **The client never constructs a storage path.** The Edge Function derives it from the
   authorized entity. A client-supplied path is a directory-traversal and cross-tenant write
   primitive — and it is precisely the pattern `bank-files-api` uses today, where `file_url` is
   accepted from the request body.
2. **The database stores the object path, never a URL.** URLs are minted at read time with short
   TTLs. Storing signed URLs would bake in expiry and leak on any DB export.
3. **MIME is validated by content sniffing, not by extension or by the `Content-Type` header.**
4. **Downloads are also brokered** — `POST /signed-download` re-authorizes on every request, so
   revoking a residence link revokes document access immediately rather than at TTL expiry.

### 1.4 Storage RLS

Even though clients never hold storage credentials, policies are written as defense in depth
(same reasoning as Doc 04 §3.1):

```sql
-- Illustrative specification. NOT a migration.
CREATE POLICY "billing_documents_tenant_read" ON storage.objects FOR SELECT
USING (
  bucket_id = 'billing-documents'
  AND (
    public.is_tenant_member((storage.foldername(name))[1]::uuid)
    OR public.is_residence_member_of_tenant((storage.foldername(name))[1]::uuid)
  )
);
```

No `INSERT`/`UPDATE`/`DELETE` policy is granted to `authenticated` on any bucket — writes happen
exclusively through signed URLs minted by Edge Functions.

### 1.5 Retention & lifecycle

| Bucket | Retention | Trigger |
|---|---|---|
| `billing-documents` | 5 years (fiscal) | Legal minimum; never auto-deleted before |
| `support-attachments` | 2 years after request closure | Scheduled job |
| `meter-photos` | 12 months | Evidence window past dispute period |
| `profile-photos` | Until replaced or account deletion | LGPD erasure request |
| `bank-files` | 5 years | Fiscal |

LGPD erasure must reach storage, not only the database. A "deleted" resident whose uploaded ID
photo remains in a bucket has not been deleted. The erasure path is an explicit checklist item in
Doc 07.

---

## 2. Realtime

### 2.1 What genuinely needs it

Realtime is a cost — connection management, reconnect logic, RLS-evaluated subscriptions, and a
new class of state bugs. It is justified only where a stale screen is actively misleading.

| Module | Realtime? | Rationale |
|---|---|---|
| **Support messages** | ✅ **Yes** | The resident is in a conversation. A reply that appears only on manual refresh reads as an unanswered request |
| **Support status changes** | ✅ **Yes** | Same thread; drives `hasUnreadMessages` and `eligibleActions` |
| **Notifications** | ✅ **Yes** | The unread badge is the app's primary signal. A stale badge is a broken promise |
| Invoice status | ➖ No | Payment settlement takes hours-to-days via CNAB. Polling on focus is sufficient and far cheaper |
| Consumption / readings | ➖ No | Monthly cadence |
| Notices | ➖ No | Arrives as a notification, which is realtime |
| Profile / preferences | ➖ No | Single-user, single-session in practice |
| Collector reading sync | ✅ Yes (Collector App) | Different program; listed for completeness |

Three channels. Not eleven.

### 2.2 Channel design

```
resident:{profile_id}:notifications   → notifications INSERT/UPDATE where profile_id = me
resident:{profile_id}:support         → support_messages + support_requests for my requests
```

### 2.2.1 Privilege model

Under ADR-07, `authenticated` holds **no** table grants except the two narrow `SELECT` grants
required by ADR-09:

```sql
GRANT SELECT ON public.notifications    TO authenticated;
GRANT SELECT ON public.support_messages TO authenticated;
```

PostgreSQL checks privileges before RLS. Without these grants, `postgres_changes` subscriptions would
connect but receive no events. With them, Realtime evaluates the RLS policies in Doc 04 §3.3
(Communication and Support matrix rows):

- `notifications` — `SELECT` only where `profile_id = auth.uid()`.
- `support_messages` — `SELECT` only where the message belongs to a `support_request` whose
  `profile_id = auth.uid()`.

Realtime is therefore the one path where RLS is load-bearing for normal traffic, not merely defense
in depth. This is also why a resident-scoped table such as `support_requests` does **not** need a
Realtime `SELECT` grant: its changes are subscribed to indirectly through `support_messages` joins
and explicit refetch, not through direct `postgres_changes` on `support_requests`.

### 2.2.2 Topic scoping

Subscriptions are scoped by `profile_id`. Association staff do not subscribe to resident channels;
they consume support and notification state through Edge Functions (`service_role`).

### 2.3 Degradation

Realtime is an **enhancement layer, never a data source**. Every screen must render correctly with
Realtime entirely unavailable:

1. Initial state always comes from the REST aggregate call.
2. A realtime event triggers a **targeted refetch**, not a direct state patch. Patching client
   state from a payload duplicates server logic — precisely the "no duplicated business logic"
   prohibition. `eligibleActions` and `hasUnreadMessages` are server-computed; a client cannot
   derive them from an INSERT payload.
3. On disconnect: exponential backoff, and refetch on window focus.
4. The certified UX already has an `OfflineBanner` component and offline states throughout —
   Realtime loss is presented as nothing at all, because the app remains fully functional.

---

## 3. Offline strategy

### 3.1 Resident App — graceful degradation (mandated)

The Resident App is **read-dominant**. Its offline requirement is that a resident who opens the
app on a weak connection sees their last known state and a clear signal, rather than a spinner or
an error.

| Layer | Approach |
|---|---|
| **Shell** | Service worker precaches the app shell. `public/sw.js` already exists |
| **Data** | Stale-while-revalidate in the transport layer. Cached aggregate responses per residence, TTL 15 min, served immediately while revalidating |
| **Signal** | Network failure → `OFFLINE` sentinel → hooks set `isOffline` → `OfflineBanner`. **Already implemented and certified** |
| **Documents** | Boletos viewed while online are cached for offline viewing — the highest-value offline artifact a resident has |
| **Writes** | **Not queued.** Blocked with a clear message |

**Why resident writes are deliberately not queued.** Resident writes are support replies, ratings,
disputes, and preference changes — all low-frequency, all things a person will naturally retry.
Queuing them buys little and costs a great deal: a dispute submitted from a queue three days later,
against an invoice whose status has since changed, produces a support request about a state that no
longer exists. Optimistic financial writes are how trust in a billing app is lost. The honest
behaviour — "you're offline, try again" — is better product, not just cheaper engineering.

The one exception worth revisiting post-launch is drafting a support request offline, where the
draft is local and only *submission* requires connectivity.

### 3.2 Collector App — offline-first (contract only)

The Collector App is a different program; this section specifies only the **backend primitives**
it will require, so they are built once, in the right place, rather than retrofitted.

| Primitive | Where it lands | Status |
|---|---|---|
| `Idempotency-Key` on every mutation | ADR-08, `idempotency_keys` | Sprint 1 |
| Client-generated IDs (`client_reading_id`) | `meter_readings` extension (Doc 02 §3.2) | Sprint 1 |
| Batch submission endpoint | Collector program | Their sprint |
| Server-derived previous reading | Closes HIGH-02 | Sprint 1 |
| Conflict policy | Server-wins for readings; client-wins for drafts | Contract |
| Device registry | `profile_devices` / collector equivalent | Sprint 1 |

**Idempotency is the whole offline story.** An offline-first client's defining behaviour is
retrying a write whose response it never saw. Without idempotency keys, every retry over a flaky
connection creates a duplicate meter reading — which flows directly into billing. The Collector
audit rated this a Wave 1 blocker; building it in Sprint 1 of *this* program serves both apps.

### 3.3 What offline is not

Not a local mirror of the database. Not a sync engine. Not eventual consistency across residences.
Those are enormous commitments, and neither the Resident App's requirements nor the certified UX
asks for them. Scope discipline here is what keeps this program finishable.

---

**Next:** [06 — Migration Roadmap & Sprints](06-migration-roadmap.md)
