# Testing

## Vitest: Two Projects, One Config

`vite.config.ts` defines two vitest "projects" — same config file, different `test.include`:

| | `server` | `client` |
|---|---|---|
| Environment | Node | Real Chromium via `@vitest/browser-playwright` |
| Included files | `src/**/*.{test,spec}.{js,ts}` | `src/**/*.svelte.{test,spec}.{js,ts}` |
| What it's for | Pure logic, and any `*.svelte.ts` singleton tested through a plain (non-`.svelte.`) test filename | Mounting actual `.svelte` components |

**The routing rule is the test *file's* name, not the source file's.** A test targeting
`core/session/registry.svelte.ts` (which uses `$state`/`$derived`) still runs in the fast `server`
project as long as the test file itself is named `registry.test.ts`, not
`registry.svelte.test.ts` — every `core/session/*.test.ts` file in this repo does exactly this
(`registry.test.ts`, `session.test.ts`, `auth.test.ts`, `project.test.ts`, `patient.test.ts`).
Runes work outside a component tree; only mounting a real `.svelte` file needs the browser
project. See `patterns/state.md`.

**Playwright is not supported on every sandbox OS** (encountered on Ubuntu 26.04) — if the
`client` project or `npm run test:e2e*` fails to even launch, that's an environment limitation,
not a code problem. Run `npx vitest run --project=server` for everything that doesn't need a real
DOM, and verify browser-mode/e2e coverage in a supported environment (or CI, once one exists — see
`gotchas.md`, there is currently no CI workflow in this repo).

## Coverage

`vite.config.ts`'s `coverage.thresholds`: **80% for statements, branches, functions, and lines**,
v8 provider, `**/*.json` excluded. Run `npx vitest run --project=server --coverage` (add
`--project=client` too if Playwright is available) after any change — a PR that drops any metric
below 80% is not done.

## IndexedDB / Cache Storage in Tests

`core/session/*.test.ts` files that touch `RegistryService` start with `import
'fake-indexeddb/auto';` — real IndexedDB semantics (transactions, indexes, cursors) in Node, not a
hand-rolled mock. `file-cache.test.ts` mocks the browser `caches` global directly (Cache Storage
has no equivalent polyfill package in use here). Prefer the real fake over mocking `idb`/`caches`
methods individually — it catches the same class of bug real-DB-vs-mock divergence would (e.g. the
`accountId` filtering behavior in `storages.md` was verified against real cursor/index
semantics, not asserted against a mock's call arguments).

## Network-Boundary Mocking

`core/network/client.test.ts`, `core/session/auth.test.ts` etc. mock `global.fetch` (or the
`get`/`post` wrapper via `vi.mock`) directly rather than a request-interception layer — this repo
has no MSW/nock equivalent. Mock at the wrapper boundary (`$lib/core/network/client`), not
`window.fetch` sprinkled per-test, when the module under test imports the wrapper — see
`auth.test.ts`'s `vi.mock('$lib/core/network/client', ...)`.

## Playwright e2e: Two Distinct Suites

| | `npm run test:e2e` | `npm run test:e2e:live` |
|---|---|---|
| Config | `playwright.config.ts` | `playwright.live.config.ts` |
| Target | `npm run build && npm run preview` (static SPA, no backend) | Real `./manage.sh up` dev stack at `https://localhost` |
| Test dir | `e2e/` | `e2e/live/` |
| Purpose | Smoke-test the built shell renders | Full real workflow: login → upload DICOM → autofill (real YOLO inference, ~110s cold) → verify computed parameters and diagnosis text render — no mocks, hits Django/Celery/MySQL/Redis/MinIO for real |

`e2e/live/autofill-workflow.test.ts` asserts backend reachability first
(`GET https://localhost/api/health/`) and fails fast with an actionable message if the stack isn't
up, rather than timing out deep into the flow. Its login credentials are a guess
(`admin@example.com`/`admin`) — not verified against whatever actually seeds the live dev stack;
fix the credentials there first if it fails at the login step specifically.

## Writing a New Test

- One test file per source file, `<name>.test.ts` next to the source it covers (not a parallel
  `__tests__/` tree) — matches every existing `core/`/`features/`/`shared/` pair in this repo.
- Prefer testing the exported singleton/function directly over mounting a component when the
  logic under test doesn't need the DOM — cheaper, runs in the `server` project, most of this
  repo's coverage comes from this tier.
- `expect: { requireAssertions: true }` is set globally — a test with no assertion fails, not
  passes silently.
