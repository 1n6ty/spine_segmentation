# Media Serving

Two buckets, two different access patterns — never presigned URLs for either.

| | Bucket | Model field | Served via |
|---|---|---|---|
| Public | `media-public` | `common/storages.py`'s `PublicMediaStorage` | Nginx `proxy_pass` straight to MinIO, `location ~ ^/media/public/(?<object_key>.+)$` |
| Private | `media-private` | `PrivateMediaStorage` — e.g. `FileManager.CasFileMixin.file` (`storage=storages["private"]`) | Django checks auth, then `X-Accel-Redirect` to an `internal;` Nginx location, which alone talks to MinIO |

**Private serving flow** (`FileManager.utils.serve_file_response` is the reference
implementation, used by `Dicom/v1/views/dcmparse.py`'s `file` action):

```python
def serve_file_response(file_obj) -> HttpResponse:
    """file_obj is any model instance that has .file (FileField) and .name (str)."""
    content_type, _ = mimetypes.guess_type(file_obj.name)
    response = HttpResponse(content_type=content_type or 'application/octet-stream')
    response['Content-Disposition'] = f'attachment; filename="{file_obj.name}"'
    response['X-Accel-Redirect'] = f'/internal/private/{file_obj.file.name}'
    return response
```

**The `X-Accel-Redirect` path must match Nginx's internal location exactly** —
`backend/Nginx/templates/api.conf.template`:

```nginx
location ~ ^/internal/private/(?<object_key>.+)$ {
    internal;
    set $minio_upstream "http://${MINIO_PROXY_HOST}:9000/media-private/$object_key";
    proxy_pass $minio_upstream;
}
```

Nginx itself prepends the `media-private` bucket name when building the upstream MinIO URL — the
Django-side path must be `/internal/private/<object key>`, **not**
`/internal/media-private/<object key>` (that was a real bug here once: passed its own test because
the test only checked the file name was a *substring* of the header, not the exact path — assert
the full expected string, not just `assertIn`, for any new `X-Accel-Redirect` response).

**Never generate a presigned/signed MinIO URL for private media** — always go through this
X-Accel-Redirect indirection, so Django's own auth/permission checks gate every private file
access, not MinIO's.

**Content-addressable storage (CAS) / dedup** — `FileManager` app:
- `FileManager.CasFile`: registry of every unique physical object, keyed by `path` (always
  `f"files/{sha512_hexdigest}"`, via `FileManager.utils.build_cas_path`/`compute_hash`), with an
  atomically-maintained `ref_count`.
- `FileManager.CasFileMixin`: abstract base any file-holding model subclasses (e.g.
  `Dicom.DicomFile`) to get CAS-backed dedup for free — `post_save`/`post_delete` signals
  increment/decrement `ref_count`, deleting the physical object only once it hits 0 (via
  `transaction.on_commit`, so a rolled-back save never triggers a real delete).
- `FileManager.FileRole`: per-role `max_count` cap (e.g. `Dicom`'s `DICOM_XRAY_FRONTAL`/
  `DICOM_XRAY_SAGITTAL` roles, capped at 1 file per Series) — checked via
  `FileManager.utils.check_role_max_count` before any write. **How that check is actually
  enforced under concurrency depends on the role's `max_count` value** — see below.

### Enforcing `FileRole.max_count`: `max_count=1` vs `max_count>1`

`check_role_max_count` (a plain `count()` query, then compare) is a **check-then-act**: nothing
stops two concurrent requests from both passing the check before either has written its row. It
exists to turn the common (non-racing) case into a clean 400 with a readable message — it is
**never**, by itself, the actual guarantee against a race. What closes the race depends on the
cap:

- **`max_count == 1`** — a DB-level `UniqueConstraint` on `(parent, role)` is the real enforcement
  (`Dicom.DicomFile.Meta.constraints`, `dicom_one_file_per_series_role`, is the reference
  example). Free, no locking, no held transaction — the DB simply rejects the second concurrent
  insert outright. This only works because a `UniqueConstraint` can express "this tuple appears at
  most **once**" — it cannot express "at most **N**" for any `N > 1`.
- **`max_count > 1`** — there is no DB-level constraint that can do this job. The only correct
  enforcement is `select_for_update()` on the **parent** row (the entity the files attach to —
  e.g. the `Series`, not the file being counted) inside a transaction, wrapping the count-check +
  insert: lock the parent, recount, then write. This serializes concurrent writes to *that specific
  parent* (and only that parent — unrelated parents never contend), which is the necessary
  narrower cost of supporting `N > 1` at all. Locking is real overhead (every write, even a
  non-conflicting one, now pays for a transaction + row lock, and unrelated writes to different
  roles on the same parent may contend on the same lock too) — this project deliberately doesn't
  pay that cost for roles that don't need it.

**If you ever change an existing `max_count=1` role to `max_count>1`** (or add a new role with
`max_count>1`), the `UniqueConstraint` backing it must be dropped and replaced with the
`select_for_update()` pattern above — leaving the `UniqueConstraint` in place would let
`check_role_max_count` correctly allow the Nth file while the DB insert then fails with an
unhandled `IntegrityError` (a raw 500, not the clean 400 the check was supposed to produce).

- **Never re-point an existing `CasFileMixin` row's `.file` at a different CAS path in place** —
  the ref-counting signals only fire on `post_save(created=True)`/`post_delete`, so an in-place
  `.file` reassignment silently skips incrementing the new path's count and never decrements the
  old one. Replace content by deleting the row and creating a new one instead
  (`Dicom.utils.parse.parse_and_store_dicom` is the reference implementation).
