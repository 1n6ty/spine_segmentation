# Auth

## The Rule

**`authService.status` (`core/session/auth.svelte.ts`) is the only thing allowed to gate
protected UI or data.** Never gate on a locally-cached flag, cookie presence, or "we called
login() earlier this session" — a deleted/expired session cookie must actually revoke access.
This file used to hold a `hasSession` localStorage flag that was set on login and only ever
cleared by an explicit logout call; deleting the session cookie (server-side expiry, or just
clearing cookies in devtools) left the flag — and everything gated on it — untouched. That flag
and its module (`core/session/auth.ts`) no longer exist; don't reintroduce one.

## `authService`

```ts
class AuthService {
	status = $state<AuthStatus>('unknown'); // 'unknown' | 'authenticated' | 'unauthenticated'
	async verify(): Promise<boolean> { /* GET /api/profiles/me/ */ }
	reject(): void { /* clears researcher identity + registry account scope */ }
}
```

- `verify()` is the *only* thing that can set `status = 'authenticated'`, and only after a real
  `GET /api/profiles/me/` 200. On any non-2xx or network error it calls `reject()` and returns `false`.
- `verify()` also populates `researcherService.email`/`.fullName`/`.duty` from the response and
  calls `registry.setAccountId(String(me.id))` — see `storages.md` for why.
- `reject()` clears researcher identity and sets `registry.setAccountId(null)`. Call it on logout
  and let `verify()` call it internally on a failed check; don't duplicate its clearing logic
  elsewhere.

## Response Shape

`GET /api/profiles/me/`'s `.data` is a backend `User_Item_Schema` (`common/schemas/v1/domain/user.py`)
— richer than just identity: `{ id, first_name, last_name, patronymic, email, is_active, phone,
company, role, permissions }`, where `company`/`role` default to the short `{slug, name}` ref
shape (pass `?extend=company,role` for the full nested object — not needed here). The frontend's
local `Me` type in `auth.svelte.ts` only declares the fields it actually reads (`id`, `email`,
`first_name`, `last_name`, `role`) — extend it rather than widening it speculatively if a new
field is needed. `researcherService.duty` is set from `role?.name` (e.g. `"Doctor"`), falling back
to `null` if the profile has no role assigned.

There's a second, functionally identical endpoint at `GET /api/me/` (`Core/v1/views/auth.py`) —
both call the same `common/utils/user.py::aget_current_user`. The frontend calls the
`/api/profiles/me/` one since profile/identity data is Profile's resource to own; don't add a
third caller of `/api/me/` without a reason.

## Who Calls `verify()`

Only two places call it — everything else just reads `authService.status` reactively:

- `routes/[lang]/(authenticated)/+layout.svelte` — `onMount`, gates **rendering** (not just a
  post-render redirect) behind a `checked` flag so protected content (Researches list, DICOM
  upload card, the editor/measure/report pages) never mounts before the check resolves.
- `routes/[lang]/+page.svelte` (public landing) — same call, gates the Researches/DICOM-upload
  cards, since this page is reachable logged out.
- `routes/[lang]/(public)/login/+page.svelte` — calls it once after a successful `POST
  /api/login/` to pull real identity, since the login response itself carries none (see
  `network.md`'s envelope note — `/api/login/`'s `data` is empty on success).

`ProfileBar.svelte` (rendered by `Header.svelte` on both public and authenticated pages) does
**not** call `verify()` itself — it just reads the shared singleton's `.status`, relying on
whichever parent page/layout already triggered the check. Don't add a redundant `verify()` call
inside a leaf component; find the enclosing page/layout that should own it instead.
