# Testing

## Philosophy

- **No ORM mocking.** All tests hit a real database. Mock-free tests catch migration errors,
  constraint violations, and query bugs that mocks hide.
- **Every view module → a matching test module**, split further by action/concern if a module ever
  outgrows one file (`<App>/v1/views/<resource>/list.py`/`create.py`/... ↔
  `<App>/v1/tests/test_<resource>/test_list.py`/...) — no app currently needs this; every real
  `views.py`/`tests/test_*.py` here is still one file per resource. A view without any test
  coverage is not considered covered. Same for celery task files.
- **Every test file covers at minimum:** `401` (unauthenticated), `403` (wrong permission), `404`
  (not found / cross-scope access where relevant), `400` (invalid input), `200`/`201` (happy path),
  and its own **URL shape** (below) — not just that the endpoint 200s.
- **Coverage target: ≥ 80%** — `coverage report` after each run.

**Every endpoint test asserts the literal URL `reverse()` produces, not just that it resolves.**
`self.client.get(reverse('Profile-detail', kwargs={'user_id': self.user.pk}))` alone only proves
*some* view answered — if a routing bug makes the wrong view greedily match first (see
`docs/gotchas.md`'s `lookup_value_regex` row), that view can still return 200 and the test stays
green. Assert the string too:

```python
def test_detail_url_shape(self):
    url = reverse('Profile-detail', kwargs={'user_id': self.user.pk})
    self.assertEqual(url, f'/api/profiles/{self.user.pk}/')
```

Every app is double-mounted, bare and `v1/`-prefixed (`patterns/urls.md`) — but `reverse()` always
resolves to the **bare** `/api/<app>/...` form, never `/api/<app>/v1/...` (confirmed across every
app's router-registered names: `Core-auth-login`, `Dicom-parse`, `Company-detail`, `Profile-list`
all reverse bare). Assert the bare form; don't guess `v1/` into the expected string.

**The `v1/`-prefixed mount needs its own check — `reverse()` can't produce it, so a per-endpoint
`test_url_shape` never touches it.** The double-mount is one mechanism per app, not per-endpoint code, so verify it **once per app**, in a
single dedicated `test_urls.py`, rather than duplicating a check into every endpoint's own test
file. Two complementary checks: `resolve()` both forms for every registered URL name and assert
they hit the identical view + kwargs (routing-table coverage, no DB needed —
`django.test.SimpleTestCase`); plus a couple of real end-to-end hits through the literal
`v1/`-prefixed path via the test client, proving the mount actually serves a response and isn't
just resolving to the right view on paper. See `Profile/v1/tests/test_urls.py` for the reference
implementation of both checks.

---

## Shared Test Fixtures

No app currently uses a shared `APITestCase` base class — most test modules just build what they
need directly in `setUp`/`setUpTestData` (see `Core/v1/tests/test_auth.py`, `Profile/v1/tests/
test_profile.py`). Where a fixture is genuinely reused across a whole app's test suite, it's a
plain helper function in `<App>/v1/tests/base.py`, not a subclass — e.g. `Company/v1/tests/
base.py`'s `create_company_user(username, company, *, can_view_any_company=False)`, which every
`Company` test module calling it imports directly:

```python
def create_company_user(username, company, *, can_view_any_company=False):
    user = User.objects.create_user(username=username, password='pw')
    Profile.objects.create(user=user, company=company)
    if can_view_any_company:
        permission = Permission.objects.get(
            codename='view_company_any_company', content_type__app_label='Company',
        )
        user.user_permissions.add(permission)
    return user
```

Add a narrow helper like this to an app's `tests/base.py` for whatever a subclass repeatedly needs,
once 2+ test modules in that app would otherwise duplicate the same setup — don't introduce a
shared base class speculatively before that's true.

---

## Parler Translation Pattern in Tests

Django-parler maintains a `_translations_cache` on model instances; `set_current_language() +
save()` in `setUp` causes ordering-dependent, intermittent failures across the full suite (see
`docs/gotchas.md`). Always go straight to the ORM instead, everywhere a translation is set in a
test or a management command:

```python
instance.translations.update_or_create(language_code='en-us', defaults={'name': 'Preview'})
```

---

## Test Tiers

The suite has two tiers, running the **exact same tests** — they differ only in which settings
module backs external services.

| | Mocked Tier | Docker Tier |
|---|---|---|
| `DJANGO_ENV` | `test` | `test_docker` |
| Database | SQLite `:memory:` | Real MySQL (via proxysql) |
| Cache / Redis | In-process `fakeredis` | Real Redis |
| Channel layer | `InMemoryChannelLayer` | Real Redis (`channels_redis`) |
| Elasticsearch | No fake client — signal processor no-ops | Real Elasticsearch, Celery-dispatched |
| File storage | Local `FileSystemStorage` (swapped in `setUpClass`) | Real MinIO (unswapped) |
| `settings.MOCK_EXTERNAL_SERVICES` | `True` | `False` |

Gate any new tier-dependent code on `settings.MOCK_EXTERNAL_SERVICES` (or the pattern below) — never
add a new `DJANGO_ENV` string comparison.

Elasticsearch has no fake-client tier at all — `ElasticMockNew` was evaluated and rejected as
structurally incompatible with `elasticsearch.helpers.bulk()` (see `docs/gotchas.md`). It stays
real-only/Docker-tier-only.

### Real-Environment Tests

Some tests are meaningless without a real backing service (e.g. genuine Redis pub/sub timing). Gate
them on the actual resolved backend class, not `DJANGO_ENV`:

```python
_HAS_REAL_REDIS = settings.CACHES['default']['BACKEND'] == 'django_redis.cache.RedisCache'

@unittest.skipUnless(_HAS_REAL_REDIS, "requires real Redis (Docker tier) -- see docs/testing.md")
class PresenceHelperTests(SimpleTestCase):
    ...
```

`settings/test_mocked.py` also resolves to `'django_redis.cache.RedisCache'` (just with a fake
`CONNECTION_FACTORY`), so this gate passes under **both** tiers today — checking the resolved
setting instead of `DJANGO_ENV` is what makes that work.

---

## Running the Suite

**Mocked tier** (from `backend/Mainland/`, root `.venv` active — fast, no Docker):

```bash
DJANGO_ENV=test python manage.py test Profile --verbosity=2   # single app
DJANGO_ENV=test coverage run manage.py test && coverage report   # full suite + coverage
```

`ModuleNotFoundError: No module named 'fakeredis'` → re-run `pip install -r req.dev.txt`.
`./manage.sh test --no-frontend --mocked` runs the same suite in its own isolated Compose project
(`$JOB_PREFIX-test`), no venv setup needed. No CI is configured in this repo yet (see `docs/dev.md`)
— both tiers are currently run manually.

**Docker tier** (from the repo root):

```bash
./manage.sh test --no-frontend --docker
```

Brings up an isolated `compose.dev.yml` stack and runs `manage.py test` inside its `api` container
against real MySQL/Redis/MinIO. `--no-frontend` skips the unrelated `frontend/` suite. With **neither**
`--mocked` nor `--docker`, `./manage.sh test --no-frontend` runs both tiers back-to-back — the
default, since both must pass.

**Both tiers must pass before a feature is done.** If a test passes Mocked but fails Docker, the
Docker result is authoritative.

---

## Backward-Compatibility Check

A different kind of check: does the code currently running in production still work once the
database has been migrated to *this branch's* schema? Matters for rolling deploys, where the DB is
typically migrated before every old replica has rolled over.

```bash
./manage.sh test-compat --env-path=example.env
```

Mechanism: runs this branch's own `manage.py test --keepdb` first (migrates the shared test DB to
this branch's full graph), then builds a second image from a `git worktree` checkout of
`origin/release` and runs *its* `manage.py test --keepdb` against the same already-migrated
database — `--keepdb` means release's tests run directly against the newer schema without
re-migrating. A real incompatibility (e.g. a new `NOT NULL` column release's code doesn't populate)
surfaces as a genuine test failure. `seed_dev_data` is deliberately not part of this flow — mixing
it in would muddy schema incompatibilities with seed-script drift between branches.

Heavy (a second full Docker build), not part of the normal test loop — run manually before merging
a risky migration.

---

## Real-Backend E2E Check

A third, distinct check: does the frontend actually work end-to-end against a real, seeded backend?
The frontend's regular e2e suite (`frontend/e2e/`, `npm run test:e2e`) is a smoke test against the
static production build (`npm run build && npm run preview`) with no backend at all — this is the
separate, additive real-backend suite.

```bash
./manage.sh test-e2e --env-path=example.env
```

Brings up an isolated stack (`api`, `nginx`, `traefik`, `api-celery` — autofill needs a live Celery
worker, since `Dicom.tasks.segmentation.segment_vertebraes` runs async; nothing else in
`compose.dev.yml` pulls `api-celery` in implicitly), runs `manage.py seed_dev_data
--manifest-path=...` and copies the resulting manifest (company + one doctor account: email,
password) to `frontend/e2e/live/.manifest/seed-manifest.json` on the host, then runs the frontend's
real-backend suite (`npm run test:e2e:live`) in a Playwright container on the same Docker network —
mounted read-only into the container rather than baked in, so a reseed never needs an image rebuild.

Hits the live app at `https://traefik`, not `http://nginx`: the frontend's `FileCache`
(`frontend/src/lib/core/storage/file-cache.ts`) uses the Cache Storage API, which browsers only
expose in a secure context (HTTPS, or the literal hostname `localhost`) — plain HTTP leaves
`window.caches` undefined and the upload step hangs with no visible error. Traefik's dev router
matches any Host header (`dev/Traefik/dynamic.yml`), so `https://traefik` reaches the same stack
over real (self-signed) TLS from inside the container network. The manifest file is the contract
between `seed_dev_data` and the e2e spec, so it reads seeded credentials from it instead of
hardcoding values that could drift from what the command actually creates.

Traefik binds host ports 80/443 directly, so `test-e2e` can't run at the same time as an
already-running `up` dev stack's Traefik, regardless of the `JOB_PREFIX` project isolation
(stop the `up` stack's `traefik` container first, or don't run both at once).
