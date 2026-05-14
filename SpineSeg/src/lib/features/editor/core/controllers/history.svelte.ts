import { PUBLIC_HISTORY_LIMIT } from "$env/static/public";
import type { SessionService } from "$lib/core/session/session.svelte";
import type { Polygon } from "$lib/shared/geometry/geometry.type";

export class HistoryService {
    past = $state<Polygon[][]>([]);
    future = $state<Polygon[][]>([]);

    private limit = parseInt(PUBLIC_HISTORY_LIMIT) || 50;

    constructor(private projection: "side" | "frontal", private session: SessionService) {}

    // Current state to save
    push = (): void => {
        // Save current state to past, clear future
        const currentPolygons = this.session.projections[this.projection].polygons;
        this.past.push(structuredClone($state.snapshot(currentPolygons)));
        this.future = [];
        
        // Limit history
        if (this.past.length > this.limit) this.past.shift();

        this.session.requestSave();
    };

    // Returns: The previous state or null
    undo = (): void => {
        if (this.past.length === 0) return ;

        const previous = this.past.pop()!;
        const currentPolygons = this.session.projections[this.projection].polygons;
        this.future.push(structuredClone($state.snapshot(currentPolygons)));
        
        this.session.projections[this.projection].polygons = previous;
    };

    // Returns: The future state or null
    redo = (): void => {
        if (this.future.length === 0) return ;

        const next = this.future.pop()!;
        const currentPolygons = this.session.projections[this.projection].polygons;
        this.past.push(structuredClone($state.snapshot(currentPolygons)));
        
        this.session.projections[this.projection].polygons = next;
    };

    clear() {
        this.past = [];
        this.future = [];
    }

    canUndo = $derived(this.past.length > 0);
    canRedo = $derived(this.future.length > 0);
}