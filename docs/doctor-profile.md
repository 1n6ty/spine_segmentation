# Doctor profile

## Current state

There is no "doctor" concept in the backend's data model. `Core` provides Django's stock `User` table and session-based auth — that's it. `Study.physician_name` is a plain string copied from the DICOM file's own metadata; it is not a foreign key to `User`, and nothing links a logged-in user to the patients/studies they've worked with. There's also no "who am I" endpoint — the only auth signals available to the frontend are the 200/401 from `/api/login` and the presence of the session cookie afterwards.

Given that, "doctor-profile mechanics" in this pass means: **wire up the login/logout that already exists**, with no new backend model. If a richer profile (name, specialty, a real `Study`↔`User` ownership link, etc.) is ever wanted, that's a backend schema change and a separate piece of work — not attempted here.

## What was wired up (frontend only)

- `src/routes/[lang]/(public)/login/+page.svelte` — submits `{username, password, remember_me}` as JSON to `POST /api/login` with the CSRF header (`getCSRFToken()`, see below), redirects to the locale root on success. Note the **username field is plain text, not `type="email"`** — Django's `authenticate()` checks the literal `username` column (e.g. the default superuser is `admin`), and an `<input type="email">` would have silently blocked non-email usernames via native HTML5 validation.
- `src/lib/components/layout/ProfileBar.svelte` — logout calls `POST /api/logout`, clears the local `researcherService` state, redirects to login.
- `src/lib/core/session/researcher.svelte.ts` — a pre-existing plain reactive class (`email`, `fullName`, `password`, `duty`, all nullable). Login only ever populates `fullName` with the username just used to sign in — that's the only thing actually known post-login. `password` is intentionally never written to it; `duty`/`email` are left `null` rather than fabricated, since no such data exists.

### Route guard is client-side, not a `+layout.server.ts` load function

`SpineSeg` is built with `@sveltejs/adapter-static` and SPA `fallback: 'index.html'` (see [build-and-deploy.md](build-and-deploy.md)) — there is no server process evaluating routes at request time in production, so a `.server.ts` load function can never check a live session per request. The previous `(authenticated)/+layout.server.ts` was deleted for this reason.

The replacement, in `(authenticated)/+layout.svelte`, is a client-side `onMount` check for the `sessionid` cookie's mere presence (Django's default session cookie name — confirmed via `settings.py`, no `SESSION_COOKIE_NAME` override exists), redirecting to `/login` if absent. This is explicitly a **UX heuristic, not the real security boundary** — the cookie could in principle be stale. Actual enforcement is whatever the backend does when a session-gated request is rejected (today: nothing gates on it server-side either — see below).

## Important correction: login is not currently a hard prerequisite for anything

The original integration plan for this feature assumed the segmentation WebSocket (`ws/dcm/segment/{sop_uid}/`) requires an authenticated session because it's wrapped in Channels' `AuthMiddlewareStack`. Reading `common/mixins/v1/ws_consumer.py` directly shows this isn't actually enforced: `WSConsumer.connect_wrapper()` only reads `self.scope["user"].pk` for Redis bookkeeping, and never checks `is_authenticated`. `AnonymousUser.pk` is `None`, so anonymous connections are accepted, not rejected — they just get tracked under a shared `wb:user:None:groups` key instead of a per-user one.

The same was true everywhere else, with one exception added since: no view in `Core` or `DSL`, and only one in `Dicom`, sets `permission_classes` — `REST_FRAMEWORK` has no `DEFAULT_PERMISSION_CLASSES` override, so DRF's default `AllowAny` applies everywhere else. `POST /api/dcm/parse` and `POST /api/dsl/select/` are both still open today. The one exception: `GET /api/dcm/<sop_uid>/file/` (added for the MinIO media-storage migration, see [backend-architecture.md](backend-architecture.md)) requires `IsAuthenticated` — the first real enforcement point in this project, deliberately placed there since it serves PHI.

Practically: the autofill ("magic button") flow in [autofill-integration.md](autofill-integration.md) still works whether or not the user is logged in — uploading and segmenting a DICOM file doesn't touch the new file-serving endpoint. Login/logout were still wired up as requested (it's clearly the intended direction — the auth scaffolding, session hardening, and `AuthMiddlewareStack` wrapping all exist for a reason), but don't treat "user must log in" as load-bearing for autofill itself.

## CSRF

`getCSRFToken()` (`src/lib/core/network/csrf.ts`) reads `window.CSRF_TOKEN` if set, otherwise falls back to the `csrftoken` cookie. Every state-changing fetch added in this pass (`login`, `logout`, `/api/dcm/parse`, `/api/dsl/select/`) sends it via the `X-CSRFToken` header, matching Django's expected header name.
