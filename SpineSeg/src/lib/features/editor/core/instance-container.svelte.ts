import type { SessionService } from "$lib/core/session/session.svelte";
import { EditingController } from "./controllers/edit.svelte";
import { NavigationController } from "./controllers/nav.svelte";

export class InstanceContainer {
    mainCanvas = $state<HTMLCanvasElement | null>(null);
    miniCanvas = $state<HTMLCanvasElement | null>(null);

    // Composed Controllers
    nav!: NavigationController;
    edit!: EditingController;

    constructor(public readonly projection: "side" | "frontal", public readonly session: SessionService) {
        this.nav = new NavigationController(this);
        this.edit = new EditingController(this);
    }

    // Unified entry point for the UI to trigger redraws
    refresh() {
        this.nav.clear();
        this.edit.clear();
    }
}