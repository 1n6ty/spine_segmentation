# Frontend — Agent Reference

SvelteKit 5 (runes) SPA. Read `frontend/docs/` for authoritative patterns before writing code.

Full layout + placement rules: `docs/architecture.md`.

## Commands

Run from `frontend/`.

```bash
npm run dev              # dev server
npm run build             # production build (static SPA)
npm run check              # svelte-check
npm run lint                # prettier + eslint
npx vitest run --project=server --coverage   # fast unit suite, no browser needed (see docs/testing.md)
npx vitest run --project=client               # component tests — needs a Playwright-supported OS
npm run test:e2e                                # smoke test against the built static shell
npm run test:e2e:live                            # real workflow against ./manage.sh up (repo root)
```

Coverage must stay ≥ 80% (statements/branches/functions/lines) — `vite.config.ts`'s
`coverage.thresholds`.

## Keeping Docs Up To Date

`frontend/AGENTS.md` and everything in `frontend/docs/` are the authoritative reference for this
codebase. Update them whenever you change a pattern, add a new concern, or discover a non-obvious
failure:

- New top-level folder or placement rule → `docs/architecture.md`
- New coding pattern or convention → the relevant file under `docs/patterns/`, or a new one if it's
  a genuinely new concern
- New endpoint this frontend calls → `docs/architecture.md`'s API contract table
- New test requirement or fixture pattern → `docs/testing.md`
- New non-obvious failure found → a row in `docs/gotchas.md`

Stale docs are worse than no docs — keep entries short, factual, and grounded in what's actually
in the codebase today, not aspirational.

## Detailed Docs

- [architecture.md](docs/architecture.md) — folder layout, placement rules, state/persistence
  overview, API contract (where to get `/api/schema/`)
- [patterns/](docs/patterns/) — `state.md`, `network.md`, `auth.md`, `i18n.md`, `routing.md`,
  `storages.md`, `naming.md`
- [testing.md](docs/testing.md) — vitest project split, coverage, e2e suites
- [gotchas.md](docs/gotchas.md) — non-obvious failure table
