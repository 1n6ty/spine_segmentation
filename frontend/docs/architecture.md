# Architecture

Folder layout and placement rules only. See `frontend/AGENTS.md` for how this fits with the rest
of `docs/`.

SvelteKit 5 (runes), `adapter-static` with SPA `fallback: 'index.html'`, only a prerendered shell + client-side routing
(`svelte.config.js`). Every `+layout.ts`/`+page.ts` is a **universal** load function, never
`+layout.server.ts`/`+page.server.ts`.

## Folder Layout

```
src/
├── lib/
│   ├── assets/icons/          # .svg only, one concern
│   ├── components/
│   │   ├── layout/              # page-skeleton chrome: Header, Footer — no business logic
│   │   ├── sections/              # composed, page-specific blocks (key-features, measurements, patient-info)
│   │   └── ui/                      # reusable interactive widgets — button, editor canvas, session cards, ProfileBar
│   ├── core/                          # state-holding singletons + cross-cutting infra, imported everywhere
│   │   ├── i18n/                        # svelte-i18n setup + the url-lang bridge (patterns/i18n.md)
│   │   ├── network/                      # fetch wrappers, CSRF, SSE (patterns/network.md)
│   │   ├── session/                       # SessionService, RegistryService, AuthService, researcher and etc. (patterns/state.md, patterns/auth.md, patterns/storages.md)
│   │   └── project.svelte.ts                # single entry point aggregating the session singletons — `import { project } from '$lib/core/project.svelte'`
│   ├── features/                       # state-dependent business logic — pure-ish but reads/shapes domain data, not UI
│   └── shared/                         # pure, stateless utils — no svelte imports, no core/features dependency
└── routes/
    ├── +layout.ts                   # root: only handles the true zero-segment `/` (see patterns/routing.md)
    └── [lang]/
        ├── +layout.ts                 # validates `params.lang`, redirects preserving the rest of the path
        ├── +layout.svelte               # calls `set_locale`, gates render on `i18nState.i18nReady && project.registry.ready`
        ├── +page.svelte                   # public landing page (Researches/DICOM-upload cards, gated on auth — patterns/auth.md)
        ├── (public)/                        # public-dedicated endpoints
        └── (authenticated)/                   # +layout.svelte gates all children on `authService.verify()`
            └── ({role})/                         # role-dedicated subgroup
```

## Placement Rules

- **`core/`** — anything that holds cross-page state or talks to the network/browser storage
  layer, instantiated once as a module-level singleton (`export const x = new X()`), reactive via
  Svelte 5 runes in a `*.svelte.ts` file. See `patterns/state.md`.
- **`features/`** — logic that depends on or shapes session/domain state but isn't itself a
  long-lived singleton — e.g. `runAutofill(...)`, the diagnosis rule engine, geometry calculators
  keyed off polygon data. If it needs `core/session` state as input, it's a feature, not `shared`.
  A feature may still export its own small `$state` singleton for state that's local to that
  feature's own UI (an active tab, a selected filter) — singleton-ness alone doesn't route
  something to `core/`; what does is whether the state *is* cross-page session/domain data. See
  "Feature-Local State" in `patterns/state.md`.
- **`shared/`** — pure functions only: no `$state`, no imports from `core/` or `features/`, no
  DOM/browser APIs beyond what's passed in as an argument. `shared/geometry`, `shared/utils/date.ts`,
  `shared/utils/hash.ts` are the reference examples.
- **`components/layout/`** vs **`components/ui/`** — layout owns page chrome with no business
  logic (`Header`, `Footer`); ui owns anything interactive/stateful, however small. `sections/` is
  for a bigger composed block specific to one page area (`key-features`, `measurements`,
  `patient-info`) that itself uses several `ui/` pieces.
- **2+ places need it → move up**, same rule as the backend: code needed by both a route and a
  `ui/` component moves to `core/` or `features/`, not either call site.
- **Constants** — no dedicated `constants.ts` per module (unlike the backend's `constants.py`).
  A constant used by only one file stays inline in that file (`NORMAL_BAND_DEG` in
  `diagnosis/rules/frontal.ts`, `HIT_RADIUS_PX` in `central-line.svelte.ts`). One used by 2+ files
  gets promoted to its nearest shared ancestor under the same rule above — e.g.
  `PROJECTION_TO_FILE_ROLE_SLUG` in `dicom/types.ts`, `parametersConfig` in
  `medical-parameters/config.ts`. **Deploy-time tunables** (values ops might change per
  environment — reconnect attempts/delays, history limit) are the one exception: those go in
  `.env` as `PUBLIC_`-prefixed vars, read via `$env/static/public`, not as code constants at all.

## State Management

`core/project.svelte.ts` is the single aggregation point — `import { project } from
'$lib/core/project.svelte'` gives `.session`, `.researcher`, `.registry`, `.auth`. Don't import
the individual `core/session/*.svelte.ts` singletons directly outside `core/` itself; go through
`project`. Full pattern (why singletons, not stores; `.svelte.ts` vs `.ts` naming) in
`patterns/state.md`.

## Local Persistence

The backend (`UserRecentStudies`) is the source of truth for a user's recent studies, not the
browser. No IndexedDB, no Cache Storage, no `localStorage` either — DICOM bytes, polygons, and even
the current session id live in memory for the current tab only. Reload continuity comes from
`GET /api/dcm/recent-studies/latest/` (ownership alone identifies "mine"), not a remembered id. See
`patterns/storages.md`.

## Backend Integration / API Contract

**Contract source of truth is the live schema, not this doc or memory of past endpoints:**
`GET /api/schema/` (raw OpenAPI JSON) and `GET /api/schema/swagger-ui/` (interactive docs) when
the backend is running locally. Verify request/response shapes there (or in the backend's actual
view/schema source under `backend/Mainland/`) before wiring up a new call — don't invent a
contract. See root `AGENTS.md`.
