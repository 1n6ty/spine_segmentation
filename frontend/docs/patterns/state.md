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
