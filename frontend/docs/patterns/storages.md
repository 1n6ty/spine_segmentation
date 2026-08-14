# Storages

Three separate client-side stores, different purposes — don't conflate them. This data never
lives on the backend; DICOM files and their annotations stay in the browser by design.

| Store | What | Keyed by |
|---|---|---|
| IndexedDB (`RegistryService`) | Per-session metadata: patient brief, polygons, thumbnail | `sessionUID`, scoped to `accountId` |
| Cache Storage (`FileCache`) | Raw DICOM file bytes | SHA-256 content hash — shared across accounts by design, it's just a blob store |
| `localStorage` | Nothing authoritative | — |

## `RegistryService` (`core/session/registry.svelte.ts`) — Per-Session Metadata

IndexedDB (`idb`), one `DicomDB` database, one `sessions` object store keyed by `sessionUID`.
Each `SessionValue` (`core/session/types.ts`) holds `brief` (patient name/UID/birthdate),
`thumbnail`, and per-projection `{ hash, polygons }` — not the raw DICOM bytes themselves (those
live in `FileCache`, keyed by `hash`).

**Account-scoped.** `SessionValue.accountId` and `RegistryService.accountId` (`$state`) together
gate what `sessionValues` (the reactive, UI-facing view) exposes:

```ts
sessionValues = $derived(
	Object.fromEntries(Object.entries(this.allSessions).filter(([, v]) => v.accountId === this.accountId))
);
```

`allSessions` (private) holds every account's rows loaded from IndexedDB — TTL cleanup
(`cleanupOldSessions`, 7-day default) runs across all of them regardless of account. Only the
exposed `sessionValues` view is filtered. `setAccountId(id)` is called exclusively by
`authService` (`patterns/auth.md`) on verify/reject — never call it directly from a component.

**Why:** without this, logging in as a different account on the same browser showed the previous
account's "Researches" list — the registry had no concept of "whose session is this" at all. New
sessions are stamped with whichever account is active at `upsert()` time
(`data.accountId ?? this.accountId` — an explicit incoming `accountId` wins, so a caller can still
write cross-account if it ever needs to, but the normal `session.svelte.ts` call path never passes
one and gets the current account by default).

`clearAll()` ("Clear all" in the Researches UI) is scoped to the *current* account only — it must
never delete another account's cached sessions.

## `FileCache` (`core/storage/file-cache.ts`) — Raw File Bytes

Cache Storage API (`caches.open('dicom-storage-v1')`), keyed by the file's own SHA-256 hex hash
(`shared/utils/hash.ts`), not by session or account. `save()` dedupes automatically — if the hash
already exists, it returns the existing hash without rewriting.

**Deliberately not account-scoped.** It's a content-addressed blob store; two accounts uploading
byte-identical files sharing one cached blob leaks nothing (an account can only ever discover a
hash via its own `RegistryService`-scoped session list, which *is* account-scoped). Don't add
account-namespacing here — it would just waste storage on duplicate blobs for no isolation
benefit.

## `localStorage`

Holds nothing authoritative. See `patterns/auth.md` for the flag that used to live here and why
it was removed.
