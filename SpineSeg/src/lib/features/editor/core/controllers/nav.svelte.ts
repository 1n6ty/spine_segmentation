import type { Point } from "$lib/shared/geometry/geometry.type";
import { getClampedOffset } from "../../rendering/canvas-utils";
import { InstanceContainer } from "../instance-container.svelte";

export class NavigationController {
    view = $state({ offset: { x: 0, y: 0 }, scale: 1 });
    minScale = $state(0);
    maxScale = $state(Infinity);

    scalePercentage = $derived(
        this.minScale > 0 ? Math.round((this.view.scale / this.minScale) * 100) : 0
    );

    isDragging = $state(false);
    private lastMousePos: Point = { x: 0, y: 0 };

    constructor(private parent: InstanceContainer) {}

    handlePointerDown(e: PointerEvent) {
        const { edit } = this.parent;
        
        // Optional: Only allow panning with middle mouse button OR if in 'default' mode
        // e.button === 0 is left click, e.button === 1 is middle click
        if (edit.mode === "default") {
            this.isDragging = true;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            
            // Capture pointer so dragging continues smoothly even if mouse leaves canvas bounds
            if (e.target instanceof Element) {
                e.target.setPointerCapture(e.pointerId);
            }
        }
    }

    handlePointerMove(e: PointerEvent) {
        if (!this.isDragging) return;

        const delta = {
            x: e.clientX - this.lastMousePos.x,
            y: e.clientY - this.lastMousePos.y
        };

        this.pan(delta);

        this.lastMousePos = { x: e.clientX, y: e.clientY };
    }

    handlePointerUp(e: PointerEvent) {
        this.isDragging = false;
        if (e.target instanceof Element) {
            e.target.releasePointerCapture(e.pointerId);
        }
    }

    pan(delta: Point) {
        const { edit } = this.parent;

        if (edit.mode === "default") {
            this.view.offset.x += delta.x;
            this.view.offset.y += delta.y;
            this.clamp();
        }
    }

    // --- ZOOMING LOGIC ---

    handleWheel(e: WheelEvent) {
        e.preventDefault(); // Stop page scrolling

        // Determine zoom factor based on scroll direction
        const zoomSensitivity = 1.1;
        const factor = e.deltaY < 0 ? zoomSensitivity : 1 / zoomSensitivity;

        const pointer: Point = { x: e.offsetX, y: e.offsetY };
        this.zoom(factor, pointer);
    }

    zoom(factor: number, focalPoint?: Point): boolean {
        const oldScale = this.view.scale;
        
        // Clamp scale between min and max
        this.view.scale = Math.max(this.minScale, Math.min(this.maxScale, this.view.scale * factor));

        if (focalPoint) {
            // Convert focal point to world coordinates before zoom
            const worldX = (focalPoint.x - this.view.offset.x) / oldScale;
            const worldY = (focalPoint.y - this.view.offset.y) / oldScale;

            // Adjust offset so the world coordinate stays exactly under the mouse
            this.view.offset.x = focalPoint.x - worldX * this.view.scale;
            this.view.offset.y = focalPoint.y - worldY * this.view.scale;
        }

        this.clamp();

        return true;
    }

    zoomToCenter(factor: number): boolean {
        const { mainCanvas } = this.parent;
        if (!mainCanvas) return false;

        // Calculate the visual center of the canvas
        const centerPoint: Point = {
            x: mainCanvas.width / 2,
            y: mainCanvas.height / 2
        };

        // Use your existing zoom logic with the center as the focal point
        this.zoom(factor, centerPoint);

        return true;
    }

    zoomToFit() {
        const { projection, mainCanvas } = this.parent;
        const bitmap = this.parent.session.projections[projection].patient?.study.series.sopInstance.bitmap;

        if (!mainCanvas || !bitmap) return;

        // minScale (Contain): Ensure the entire image fits within the canvas
        const scaleX = mainCanvas.clientWidth / bitmap.width;
        const scaleY = mainCanvas.clientHeight / bitmap.height;
        
        this.minScale = Math.min(scaleX, scaleY);
        this.maxScale = this.minScale * 16;

        this.view.scale = this.minScale;

        // Center the image
        this.view.offset.x = (mainCanvas.clientWidth / 2) - (bitmap.width * this.view.scale / 2);
        this.view.offset.y = (mainCanvas.clientHeight / 2) - (bitmap.height * this.view.scale / 2);

        this.clamp();
    }

    jumpToMinimap(e: PointerEvent) {
        const { projection, mainCanvas, miniCanvas } = this.parent;
        const bitmap = this.parent.session.projections[projection].patient?.study.series.sopInstance.bitmap;

        if (!miniCanvas || !bitmap || !mainCanvas) return;

        // 1. Get click position relative to the minimap canvas element
        const rect = miniCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // 2. Use clientWidth/Height for ratio math (CSS Pixels)
        // This matches the coordinate system of clickX/clickY
        const miniW = miniCanvas.clientWidth;
        const miniH = miniCanvas.clientHeight;

        const ratio = Math.min(miniW / bitmap.width, miniH / bitmap.height);
        
        // Offset of the image within the minimap container
        const imgX = (miniW - bitmap.width * ratio) / 2;
        const imgY = (miniH - bitmap.height * ratio) / 2;

        // 3. Convert Click -> World Space
        const worldX = (clickX - imgX) / ratio;
        const worldY = (clickY - imgY) / ratio;

        // 4. Update Main View Offset
        // Center the main canvas (clientWidth) around this world point
        this.view.offset.x = (mainCanvas.clientWidth / 2) - (worldX * this.view.scale);
        this.view.offset.y = (mainCanvas.clientHeight / 2) - (worldY * this.view.scale);

        this.clamp();
    }

    clamp() {
        const { projection, mainCanvas } = this.parent;

        if (!mainCanvas || !this.parent.session.projections[projection].patient?.study.series.sopInstance.bitmap) return;
        this.view.offset = getClampedOffset(this.view.offset, this.view.scale, this.parent.session.projections[projection].patient?.study.series.sopInstance.bitmap!, mainCanvas);
    }

    clear() {
        this.view = { offset: { x: 0, y: 0 }, scale: 1 };
    }
}