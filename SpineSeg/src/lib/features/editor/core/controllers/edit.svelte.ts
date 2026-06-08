import type { Point, Polygon } from "$lib/shared/geometry/geometry.type";
import { getPointAndPolygonUnderCursor } from "../../logic/selection";
import { orderAndName } from "../../logic/orderer";
import { HistoryService } from "./history.svelte";
import type { InstanceContainer } from "../instance-container.svelte";
import { screenToWorld } from "$lib/shared/geometry/geometry";

export type EditorMode = 'default' | 'draw' | 'drag';

export class EditingController {
    draftPoints = $state<Point[]>([]);

    mode = $state<EditorMode>('default');
    cursor = $derived.by(() => {
        if (this.mode === 'drag') return 'cursor-grabbing';
        if (this.mode === 'draw') return 'cursor-crosshair';
        if (this.parent.nav.isDragging) return 'cursor-grabbing';
        return 'cursor-grab';
    });
    dragIndex = $state<number | null>(null);
    selectedPolygon = $state<Polygon | null>(null);

    history: HistoryService | null = null;

    constructor(private parent: InstanceContainer) {
        this.history = new HistoryService(this.parent.projection, this.parent.session);
    }

    setMode(mode: EditorMode) {
        this.mode = mode;
        this.draftPoints = [];
        this.selectedPolygon = null;
    }

    private commit() {
        const { projection } = this.parent;
        const newPoly = {
            uuid: crypto.randomUUID(),
            id: "",
            points: [...this.draftPoints]
        };

        this.history?.push();

        this.parent.session.projections[projection].polygons.push(newPoly);
        this.parent.session.projections[projection].polygons = orderAndName(this.parent.session.projections[projection].polygons);

        this.parent.session.requestSave();

        this.draftPoints = [];
        this.selectedPolygon = this.parent.session.projections[projection].polygons.find(p => p.uuid === newPoly.uuid) || null;

        this.mode = "default";
    }

    private getEventClientXY(e: PointerEvent) {
        const { mainCanvas } = this.parent;
        const rect = mainCanvas!.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    addPoint(p: Point) {
        this.draftPoints = [...this.draftPoints, { ...p }];
    
        if (this.draftPoints.length === 4) {
            this.commit();
        }
    }

    deleteSelected = () => {
        if (!this.selectedPolygon) return;

        this.history?.push();

        const { projection } = this.parent;
        const selectedUuid = this.selectedPolygon.uuid;

        this.parent.session.projections[projection].polygons = this.parent.session.projections[projection].polygons.filter(p => p.uuid !== selectedUuid);
        this.parent.session.projections[projection].polygons = orderAndName(this.parent.session.projections[projection].polygons);
        this.selectedPolygon = null;

        this.parent.session.requestSave();
    }

    handlePointerDown(e: PointerEvent) {
        const { projection, nav } = this.parent;
        const worldHitRadius = 12 / nav.view.scale;

        const worldPoint = screenToWorld(
            this.getEventClientXY(e),
            nav.view.offset,
            nav.view.scale
        );

        // 1. Selection logic: what is under the cursor?
        const hit = getPointAndPolygonUnderCursor(
            worldPoint,
            this.parent.session.projections[projection].polygons,
            worldHitRadius
        );

        // 2. DRAW MODE LOGIC
        if (this.mode === 'draw') {
            this.addPoint(worldPoint);
            return; 
        }

        // 3. DEFAULT MODE LOGIC (Dragging completed polygons)
        if (hit.indexInPolygon !== null && hit.indexInPolygon !== -1) {
            this.dragIndex = hit.indexInPolygon;
            this.selectedPolygon = hit.polygon || null;
            this.mode = 'drag';

            this.history?.push();
            
            if (e.target instanceof Element) {
                e.target.setPointerCapture(e.pointerId);
            }
        } else {
            // Just selecting a polygon (or clicking empty space)
            this.selectedPolygon = hit.polygon || null;
        }
    }

    handlePointerMove(e: PointerEvent) {
        if (this.mode !== 'drag' || this.dragIndex === null || this.dragIndex === -1) return;

        const { nav } = this.parent;
        const worldPoint = screenToWorld(
            this.getEventClientXY(e),
            nav.view.offset,
            nav.view.scale
        )

        // Optimization: Use structuredClone only on commit, but update state directly for performance
        if (this.selectedPolygon) {
            this.selectedPolygon.points[this.dragIndex] = { ...worldPoint };
        }
    }

    handlePointerUp(e: PointerEvent) {
        if (this.mode === 'drag') {
            if (e.target instanceof Element) {
                e.target.releasePointerCapture(e.pointerId);
            }

            const { projection } = this.parent;
            const selectedUuid = this.selectedPolygon?.uuid;
            this.parent.session.projections[projection].polygons = orderAndName(this.parent.session.projections[projection].polygons);

            // Restore selection by UUID
            if (selectedUuid) {
                this.selectedPolygon = this.parent.session.projections[projection].polygons.find(p => p.uuid === selectedUuid) || null;
            }

            this.parent.session.requestSave();
            
            this.mode = 'default';
        }

        this.dragIndex = null;
    }

    clear() {
        const { projection } = this.parent;

        this.setMode('default');
        this.history?.clear();
        
        this.parent.session.projections[projection].polygons = [];
        this.parent.session.requestSave();

        this.draftPoints = [];
        this.dragIndex = null;
        this.selectedPolygon = null;
    }
}