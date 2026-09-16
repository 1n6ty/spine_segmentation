import { SvelteMap } from 'svelte/reactivity';
import type { SessionService } from '$lib/core/session/session.svelte';
import type { Projection } from '$lib/features/dicom/types';
import { ToolController } from './controllers/tool.svelte';
import { ViewportController } from './controllers/viewport.svelte';
import { CentralLineController } from './controllers/central-line.svelte';
import { DisplayController } from './controllers/display.svelte';

export class InstanceContainer {
	mainCanvas = $state<HTMLCanvasElement | null>(null);
	miniCanvas = $state<HTMLCanvasElement | null>(null);

	// Composed Controllers
	nav!: ViewportController;
	tools!: ToolController;
	centralLine!: CentralLineController;
	display!: DisplayController;

	constructor(
		public readonly projection: 'side' | 'frontal',
		public readonly session: SessionService
	) {
		this.nav = new ViewportController(this);
		this.tools = new ToolController(this);
		this.centralLine = new CentralLineController(this);
		this.display = new DisplayController(this);
	}

	// Unified entry point for the UI to trigger redraws
	refresh() {
		this.nav.clear();
		this.tools.clear();
		this.centralLine.clear();
	}
}

/** One `InstanceContainer` per (session, projection), lazily created and reused for as long as
 * that `SessionService` (i.e. that research) stays the active one. A `WeakMap` keyed by session
 * -- rather than a field on `SessionService` itself -- deliberately keeps `session.svelte.ts`
 * free of any import of this editor-only module: session.svelte.ts is on the import path of
 * every route (patient/measure/report, not just edit), and pulling the editor's rendering code
 * into that shared chunk would bloat every one of those pages' bundles for code only the editor
 * tab ever uses. No explicit cleanup needed either -- entries are dropped automatically once
 * their SessionService is no longer referenced. */
const containersBySession = new WeakMap<SessionService, SvelteMap<Projection, InstanceContainer>>();

/**
 * `EditorCanvas.svelte` calls this instead of constructing its own `InstanceContainer` so that
 * pan/zoom, the active tool/selection, and view settings (opacity/brightness/contrast) survive
 * navigating away from the edit tab (e.g. to Measure/Report) and back -- the SAME container
 * instance is handed back each time for a given session+projection.
 */
export function getInstanceContainer(
	session: SessionService,
	projection: Projection
): InstanceContainer {
	let bySession = containersBySession.get(session);
	if (!bySession) {
		bySession = new SvelteMap();
		containersBySession.set(session, bySession);
	}

	const existing = bySession.get(projection);
	if (existing) return existing;

	// Constructing InstanceContainer transitively creates several `$derived` fields (e.g.
	// CentralLineController.centralPath, HistoryController.canUndo/canRedo, DisplayController's
	// brightness/contrast). A `$derived` created while some component happens to be mounted is
	// OWNED by that component's reactive scope -- once that FIRST-EVER-mounting EditorCanvas.svelte
	// instance later unmounts (inevitable, on the very next tab switch), Svelte marks every such
	// derived "inert": it freezes at its last value and never recomputes again (logged as the
	// `derived_inert` runtime warning), even though this container is deliberately cached and
	// reused by LATER mounts. `$effect.root()` gives the container its own persistent reactive
	// scope, independent of any component, so its derived fields keep updating for as long as the
	// container itself stays cached here -- not just for as long as whichever component built it
	// first happens to stay mounted.
	let created: InstanceContainer | undefined;
	$effect.root(() => {
		created = new InstanceContainer(projection, session);
	});
	// `$effect.root`'s callback is a no-op under Svelte's server/SSR build (there's no live
	// reactive graph to maintain for a one-shot render, so the rune has nothing to do there) --
	// this app never actually serves that render path in production (static adapter + SPA
	// fallback), but plain-Node test/SSR contexts still exercise it, so fall back to a direct
	// construction there rather than caching `undefined`.
	created ??= new InstanceContainer(projection, session);

	bySession.set(projection, created);
	return created;
}
