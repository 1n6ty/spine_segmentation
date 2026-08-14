import type { SessionService } from '$lib/core/session/session.svelte';
import { EditController } from './controllers/edit.svelte';
import { ViewportController } from './controllers/viewport.svelte';

export class InstanceContainer {
	mainCanvas = $state<HTMLCanvasElement | null>(null);
	miniCanvas = $state<HTMLCanvasElement | null>(null);

	// Composed Controllers
	nav!: ViewportController;
	edit!: EditController;

	constructor(
		public readonly projection: 'side' | 'frontal',
		public readonly session: SessionService
	) {
		this.nav = new ViewportController(this);
		this.edit = new EditController(this);
	}

	// Unified entry point for the UI to trigger redraws
	refresh() {
		this.nav.clear();
		this.edit.clear();
	}
}
