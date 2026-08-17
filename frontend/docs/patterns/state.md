# State: Runes Singletons

Every piece of cross-page state is a **module-level singleton class instance**, not a Svelte
store, not a context. A `.svelte.ts` file (the `.svelte.` infix, not just `.ts`, is what tells the
Svelte compiler to process runes in a non-component file) declares a class using `$state`/
`$derived` fields, then exports one instantiated instance:

```ts
// core/session/researcher.svelte.ts
class ResearcherService {
	email = $state<string | null>(null);
	fullName = $state<string | null>(null);
}
export const researcherService = new ResearcherService();
```

Components import the singleton and read/write its fields directly — no `.subscribe()`, no `$`
prefix (that's the old `svelte/store` API). Reactivity comes from the class fields themselves.

## The `project` Aggregator

`core/project.svelte.ts` composes every session-level singleton into one object:

```ts
class Project {
	session = $state.raw(new SessionService(null));
	researcher = researcherService;
	registry = registry;
	auth = authService;
}
export const project = new Project();
```

Import `project`, not the individual singletons, from outside `core/`. `session` uses
`$state.raw` (shallow reactivity) because `SessionService` replaces itself wholesale on session
switch rather than being mutated in place — see `session.svelte.ts`'s constructor.

## `$derived` for Computed/Filtered Views

Don't hand-write a method that reassigns a `$state` field to a filtered copy — declare the
filtered view as `$derived` and only mutate the underlying source. `RegistryService` learned this
the hard way: `sessionValues` is `$derived` off a private `allSessions` `$state` record filtered
by `accountId`; `upsert`/`delete` mutate `allSessions`, never `sessionValues` directly (it has no
setter). See `storages.md`.

```ts
private allSessions = $state<Record<string, SessionValue>>({});
sessionValues = $derived(
	Object.fromEntries(Object.entries(this.allSessions).filter(([, v]) => v.accountId === this.accountId))
);
```

For a computed value combining multiple other computed values, `$derived.by(() => {...})` reads
better than a one-line `$derived(expr)` — see `SessionService.mergedPatient`/`mergedStudy` in
`session.svelte.ts`.

## Feature-Local State

A `$state` singleton isn't by itself a signal that a module belongs in `core/`. `core/` is for
**cross-page session/domain data** — one researcher, one active session, one registry — the kind
of thing an unrelated page or feature might legitimately need to read. A feature can have its own
piece of long-lived, module-level `$state` too, as long as what it holds is UI-local to that one
feature: which of the feature's own tabs/panels is selected, a filter only that feature's own
components apply. The test isn't "is it a singleton" — it's "if another, unrelated feature imported
this, would that even make sense". If yes, it's session/domain data and belongs in `core/`. If the
state only means something to this one feature's own UI, a singleton inside `features/` is fine:

```ts
// features/image-gallery/gallery-view-store.svelte.ts
import { project } from '$lib/core/project.svelte';

// `activeFilter` is this feature's own UI selection -- nothing outside
// image-gallery's own components has a reason to read or set it. `items`
// is derived from real domain data (`project.session`), which is exactly
// why this still belongs under features/ and not shared/: it needs
// core/session state as input.
export const galleryView = $state({
	activeFilter: 'all' as 'all' | 'favorites',

	get items() {
		const all = project.session.gallery.items;
		return this.activeFilter === 'favorites' ? all.filter((i) => i.favorite) : all;
	}
});
```

Compare with an actual `core/` singleton, where the state itself — not just its consumers — is the
cross-page domain concept:

```ts
// core/session/researcher.svelte.ts
class ResearcherService {
	email = $state<string | null>(null);
	fullName = $state<string | null>(null);
}
export const researcherService = new ResearcherService();
```

`researcherService` describes *who is logged in* — every page and feature in the app potentially
cares. `galleryView.activeFilter` describes *what one panel is currently showing* — only
`image-gallery`'s own components ever will. Same shape (module-level `$state` export), different
placement, because the question is what the state *is*, not how it's declared.

## Why Not Svelte Stores / Context

Stores add `$`-prefixed subscription boilerplate runes already replace; context is per-component-
tree and wrong for state that's genuinely global (one researcher, one session registry per
browser tab). A class instance is also directly unit-testable with plain `new X()` — no
`render()`/component harness needed, which is why `core/session/*.test.ts` files import the class
directly rather than mounting anything. See `testing.md`.

## Testing These Files

A test file testing a `*.svelte.ts` source only needs the browser-mode "client" vitest project if
the test file's own name ends `.svelte.test.ts`. Every `core/session/*.test.ts` file in this repo
is plain `*.test.ts` and runs in the fast Node "server" project even though the source it tests
uses runes — `$state`/`$derived` degrade to plain reactive-but-synchronous value semantics outside
a component tree, no DOM needed. Only testing an actual `.svelte` component requires the browser
project. See `testing.md`.
