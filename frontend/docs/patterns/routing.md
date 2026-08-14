# Routing

`(public)` and `(authenticated)` are **route groups** — parens mean the segment doesn't appear in
the URL, they only exist to attach a different `+layout.svelte`. `({role})` is a role subgroup
under `(authenticated)`, for when a second role needs a sibling subgroup with a different layout.

## `[lang]` Structurally Captures Any First Segment

This is the one non-obvious thing about this route tree. `[lang]` is a **required** dynamic
segment — SvelteKit matches it against whatever the first path segment is, valid lang code or
not. Visiting `/login` (missing prefix) matches `params.lang = "login"`; it does **not** fall
through to a "no lang" case.

Two load functions split responsibility because of this:

- `routes/+layout.ts` — only ever fires for the true zero-segment `/`. Detects browser language,
  redirects to `/${lang}`.
- `routes/[lang]/+layout.ts` — fires for every other path, including malformed ones. Validates
  `params.lang` via `is_supported_url_lang()`; if it's not a real lang code, treats the whole
  captured segment as a page path with a missing prefix and redirects to
  `` `/${detected_lang}${url.pathname}${url.search}` `` — **preserving** the original path, not
  discarding it. This is what makes `/login` → `/en/login` (not `/en/`) work.

If you add a new top-level route and it doesn't redirect correctly when the lang prefix is
missing, check this file first — see `gotchas.md`.

## Guards Gate Rendering, Not Just Navigation

`(authenticated)/+layout.svelte` awaits `authService.verify()` in `onMount` and only renders its
`{@render children()}` once a `checked` flag is true *and* `authService.status === 'authenticated'` 
— protected content must not mount even briefly
before a redirect fires. A `goto()` call alone in `onMount` without gating the template is not
sufficient; the component tree still mounts on the way to the redirect. See `patterns/auth.md`.

## Static Adapter Constraints

`adapter-static` + SPA fallback (`svelte.config.js`) means there is no server at request time in
production — only universal (`+layout.ts`) load functions are valid, never
`+layout.server.ts`/`+page.server.ts`. `browser` from `$app/environment` guards any
`navigator`/`localStorage`/`document` access inside a load function or `onMount`-adjacent code,
since load functions also run once during the SSR prerender step at build time.
