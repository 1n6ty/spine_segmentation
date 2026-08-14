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
  `DICOM_XRAY_SAGITTAL` roles, capped at 1 file per Study) — checked via
  `FileManager.utils.check_role_max_count` before any write, backed by a DB-level
  `UniqueConstraint` as the real enforcement (see `Dicom.DicomFile.Meta.constraints`).
- **Never re-point an existing `CasFileMixin` row's `.file` at a different CAS path in place** —
  the ref-counting signals only fire on `post_save(created=True)`/`post_delete`, so an in-place
  `.file` reassignment silently skips incrementing the new path's count and never decrements the
  old one. Replace content by deleting the row and creating a new one instead
  (`Dicom.utils.parse.parse_and_store_dicom` is the reference implementation).
