<script lang="ts">
    import { onMount } from "svelte";
    import { locale, t } from "svelte-i18n";
    import { PUBLIC_HISTORY_LIMIT } from "$env/static/public";

	import Button from "$lib/components/ui/Button/Button.svelte";


	import { createDicomBitmap } from "$lib/utils/dicom";
	import { dicomRegistryStore, dicomSidePixelDataStore, dicomFrontalPixelDataStore } from "$lib/stores/dicom/dicom.store";
	import { currentPatientStore } from "$lib/stores/patient/patient.store";
	import type { BitmapMeta, BitmapOptions } from "$lib/features/Editor/editor.type";
	import { clampOffset, resizeCanvas } from "$lib/features/Editor/Map/canvas";
	import { resizeMinimap } from "$lib/features/Editor/miniMap/canvas";
	import { draw } from "$lib/features/Editor/Map/draw";
	import { screenToWorld } from "$lib/utils/geometry/geometry";
	import type { Point, Polygon } from "$lib/utils/geometry/geometry.type";
	import { zoomAtPoint, zoomCenter } from "$lib/features/Editor/Map/zoom";
	import { getPointUnderCursor, getPolygonUnderCursor } from "$lib/features/Editor/Map/cursor";
	import { frontalPolygonsStore, sidePolygonsStore } from "$lib/stores/study/study.store";
	import { drawMinimap } from "$lib/features/Editor/miniMap/draw";
	import { orderReferencePoints } from "$lib/features/Editor/orderReferencePoints";
	import { orderAndNameVertebrae } from "$lib/features/tspNamer";

    let { projection = "side" }: {
            projection: "side" | "frontal"
        } = $props();

    const projection_h: Record<string, Record<string, string>> = {
        en: {
            side: "Lateral View",
            frontal: "Frontal View"
        },
        ru: {
            side: "Сагиттальная Проекция",
            frontal: "Фронтальная Проекция"
        }
    } as const;

    /* -----------------------------
    View State
    ------------------------------ */

    let mainBitmapMeta: BitmapMeta = {
        canvas: null,
        ctx: null,
        scale: { min: 1, max: 16, x: 1, y: 1},
        offset: { x: 0, y: 0 },
        pointsMeta: {
            radius: 6
        }
    };
    let mainBitmapOptions: BitmapOptions = {
        scale: { maxC: 16 },
        point: { hitC: 2 }
    };

    let miniBitmapMeta: BitmapMeta = {
        canvas: null,
        ctx: null,
        scale: { min: 1, max: 16, x: 1, y: 1},
        offset: { x: 0, y: 0 }
    };

    let scalePercentage: number = $state(100);

    let polygons = $derived((projection == "side") ? sidePolygonsStore: frontalPolygonsStore);
    let points: Point[] = [];

    let dicomBitmap: ImageBitmap | null = $state(null);

    let isDragging = false;
    let lastX = 0, lastY = 0;

    let addMode: boolean = $state(false);
    let selectedPolygon: Polygon | null = $state(null);
    let draggingPoint: { poly: Polygon; index: number } | null = null;

    $effect(() => {
        const patient = $dicomRegistryStore.patients[$currentPatientStore.patientID];
        const study = patient?.studies[$currentPatientStore.studyUID];
        const series = study?.series[$currentPatientStore.seriesUID];
        const imageMeta = series?.images[$currentPatientStore.projectionsSopUID[projection]];

        const imageData = (projection == "side") ? $dicomSidePixelDataStore : $dicomFrontalPixelDataStore;

        if (imageData && imageMeta) {
            (async () => {
                // Generate bitmap
                const bitmap = await createDicomBitmap(imageData, imageMeta);
                
                // Update state
                dicomBitmap = bitmap;
                
                // Recalculate everything now that we have the bitmap
                resizeCanvas(mainBitmapMeta, mainBitmapOptions, dicomBitmap);
                resizeMinimap(miniBitmapMeta);

                draw(mainBitmapMeta, dicomBitmap, selectedPolygon, $polygons, points);
                drawMinimap(mainBitmapMeta, miniBitmapMeta, dicomBitmap);
            })();
        }
    });

    onMount(() => {
        if (!miniBitmapMeta.canvas || !mainBitmapMeta.canvas) return ;

        mainBitmapMeta.ctx = mainBitmapMeta.canvas.getContext("2d")!;
        miniBitmapMeta.ctx = miniBitmapMeta.canvas.getContext("2d")!;

        window.addEventListener("resize", () => {
            resizeCanvas(mainBitmapMeta, mainBitmapOptions, dicomBitmap);
            resizeMinimap(miniBitmapMeta);

            draw(mainBitmapMeta, dicomBitmap, selectedPolygon, $polygons, points);
            drawMinimap(mainBitmapMeta, miniBitmapMeta, dicomBitmap);
        });
    });

    /* -----------------------------
    Events
    ------------------------------ */
    
    function handleWheel(e: WheelEvent) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        scalePercentage = zoomAtPoint(miniBitmapMeta, mainBitmapMeta, dicomBitmap, selectedPolygon, $polygons, points, factor, e.clientX, e.clientY);
    }

    function getEventClientXY(e: PointerEvent) {
        if (!mainBitmapMeta.canvas) return { x: 0, y: 0 };

        const rect = mainBitmapMeta.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function pointerDown(e: PointerEvent) {
        e.preventDefault();

        if (!mainBitmapMeta.canvas) return ;

        mainBitmapMeta.canvas.setPointerCapture(e.pointerId);

        const clientP = getEventClientXY(e);

        if (addMode) {
            addPoint(e);
            return;
        }

        const hitPoint = getPointUnderCursor(mainBitmapMeta, mainBitmapOptions, clientP, $polygons, points);
        if (hitPoint) {
            saveHistory();
            draggingPoint = hitPoint;
            selectedPolygon = hitPoint.poly;
            draw(mainBitmapMeta, dicomBitmap, selectedPolygon, $polygons, points);
            return;
        }

        const hitPoly = getPolygonUnderCursor(mainBitmapMeta, clientP, $polygons);
        if (hitPoly) {
            selectedPolygon = hitPoly;
            draw(mainBitmapMeta, dicomBitmap, selectedPolygon, $polygons, points);
            return;
        }

        selectedPolygon = null;

        isDragging = true;
        lastX = clientP.x;
        lastY = clientP.y;

        draw(mainBitmapMeta, dicomBitmap, selectedPolygon, $polygons, points);
    }

    function pointerMove(e: PointerEvent) {
        e.preventDefault();
        const { x, y } = getEventClientXY(e);

        if (draggingPoint) {
            const world = screenToWorld(
                { x: x, y: y },
                { x: mainBitmapMeta.offset.x, y: mainBitmapMeta.offset.y },
                { x: mainBitmapMeta.scale.x, y: mainBitmapMeta.scale.y },
            );
            draggingPoint.poly.points[draggingPoint.index] = world;

            draw(mainBitmapMeta, dicomBitmap, selectedPolygon, $polygons, points);
            return;
        }

        if (isDragging) {
            mainBitmapMeta.offset.x += x - lastX;
            mainBitmapMeta.offset.y += y - lastY;
            lastX = x;
            lastY = y;

            clampOffset(mainBitmapMeta, dicomBitmap);
            draw(mainBitmapMeta, dicomBitmap, selectedPolygon, $polygons, points);
            drawMinimap(mainBitmapMeta, miniBitmapMeta, dicomBitmap);
        }
    }

    function pointerUp(e: PointerEvent) {
        e.preventDefault();

        if (!mainBitmapMeta.canvas) return ;

        draggingPoint = null;
        isDragging = false;

        polygons.update(store => {
            if (store.length > 1) {
                store.forEach((poly, i) => {
                    if (i == 0) {
                        orderReferencePoints(poly, store[i + 1], "down");
                    } else {
                        orderReferencePoints(poly, store[i - 1], "up");
                    }
                });
            }

            store = orderAndNameVertebrae(store);

            return store;
        });

        mainBitmapMeta.canvas.releasePointerCapture(e.pointerId);
        draw(mainBitmapMeta, dicomBitmap, selectedPolygon, $polygons, points);
    }


    /* -----------------------------
    Polygon creation
    ------------------------------ */
    let history = $state<{ past: Polygon[][], future: Polygon[][] }>({
        past: [],
        future: []
    });
    // Helper to deep clone the polygons to prevent reference sharing in history
    const clone = (data: Polygon[]) => JSON.parse(JSON.stringify(data));

    function saveHistory() {
        // Save current state to past, clear future
        history.past.push(clone($polygons));
        history.future = [];
        
        // Optional: Limit history
        if (history.past.length > parseInt(PUBLIC_HISTORY_LIMIT)) history.past.shift();
    }

    function undo() {
        if (history.past.length === 0) return;
        
        const previous = history.past.pop()!;
        history.future.push(clone($polygons));
        
        polygons.set(previous);
        draw(mainBitmapMeta, dicomBitmap, selectedPolygon, $polygons, points);
    }

    function redo() {
        if (history.future.length === 0) return;
        
        const next = history.future.pop()!;
        history.past.push(clone($polygons));
        
        polygons.set(next);
        draw(mainBitmapMeta, dicomBitmap, selectedPolygon, $polygons, points);
    }

    function addPoint(e: PointerEvent) {
        if (!mainBitmapMeta.canvas) return ;

        const rect = mainBitmapMeta.canvas.getBoundingClientRect();
        const world = screenToWorld(
            { x: e.clientX - rect.left, y: e.clientY - rect.top },
            { x: mainBitmapMeta.offset.x, y: mainBitmapMeta.offset.y },
            { x: mainBitmapMeta.scale.x, y: mainBitmapMeta.scale.y },
        );

        points.push(world);

        if (points.length === 4) {
            saveHistory();

            const newPoly: Polygon = {
                id: "",
                points: [...points]
            };

            polygons.update(store => {
                store.push(newPoly);

                if (store.length > 1) {
                    store.forEach((poly, i) => {
                        if (i == 0) {
                            orderReferencePoints(poly, store[i + 1], "down");
                        } else {
                            orderReferencePoints(poly, store[i - 1], "up");
                        }
                    });
                }

                store = orderAndNameVertebrae(store);

                return store;
            });

            selectedPolygon = newPoly;
            points = [];
            addMode = false;
        }

        draw(mainBitmapMeta, dicomBitmap, selectedPolygon, $polygons, points);
    }

    function toggleAddMode() {
        // Exit add mode
        addMode = !addMode;

        // Discard any partially placed points
        points = [];

        draw(mainBitmapMeta, dicomBitmap, selectedPolygon, $polygons, points);
    }

    function deleteSelected() {
        if (!selectedPolygon) return;

        saveHistory();

        polygons.set(
            orderAndNameVertebrae(
                $polygons.filter(p => p.id !== selectedPolygon?.id)
            )
        );

        selectedPolygon = null;
        draw(mainBitmapMeta, dicomBitmap, selectedPolygon, $polygons, points);
    }

    function clickMinimap(e: MouseEvent) {
        if (!dicomBitmap || !miniBitmapMeta.canvas || !mainBitmapMeta.canvas) return ;

        const rect = miniBitmapMeta.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Compute image drawing ratio and offsets exactly like in drawMinimap
        const ratio = Math.min(
            miniBitmapMeta.canvas.width / dicomBitmap.width,
            miniBitmapMeta.canvas.height / dicomBitmap.height
        );

        const imageOffsetX = (miniBitmapMeta.canvas.width - dicomBitmap.width * ratio) / 2;
        const imageOffsetY = (miniBitmapMeta.canvas.height - dicomBitmap.height * ratio) / 2;

        // Mouse position relative to the image
        const relX = (mouseX - imageOffsetX) / ratio;
        const relY = (mouseY - imageOffsetY) / ratio;

        // Center the main canvas viewport on that point
        mainBitmapMeta.offset.x = -relX * mainBitmapMeta.scale.x + mainBitmapMeta.canvas.width / 2;
        mainBitmapMeta.offset.y = -relY * mainBitmapMeta.scale.y + mainBitmapMeta.canvas.height / 2;

        clampOffset(mainBitmapMeta, dicomBitmap);
        draw(mainBitmapMeta, dicomBitmap, selectedPolygon, $polygons, points);
        drawMinimap(mainBitmapMeta, miniBitmapMeta, dicomBitmap);
    }

</script>

<div class="bg-(--card) text-(--card-foreground) flex flex-col gap-2 rounded-xl border border-(--border) p-4">
    <h3 class="font-semibold">{ projection_h[$locale && $locale in projection_h ? $locale: 'en'][projection] }</h3>
    <div class="flex flex-wrap justify-start gap-x-2 gap-y-2">
        <Button type="back" callback={ undo } disabled={ history.past.length === 0 }/>
        <Button type="forward" callback={ redo} disabled={ history.future.length === 0 }/>
        <Button type="magic" callback={ () => {} }>{ $t("editor.autofill") }</Button>
        <Button type="zoom-in" callback={() => {scalePercentage = zoomCenter(miniBitmapMeta, mainBitmapMeta, dicomBitmap, selectedPolygon, 1.1, $polygons, points)} } />
        <Button type="zoom-out" callback={() => {scalePercentage = zoomCenter(miniBitmapMeta, mainBitmapMeta, dicomBitmap, selectedPolygon, 0.9, $polygons, points)} } />
        {#if addMode}
            <Button type="cancel" callback={toggleAddMode} disabled={false} >{ $t('editor.cancel') }</Button>
        {:else}
            <Button type="add" callback={toggleAddMode} disabled={false} />
        {/if}
        <Button type="delete" callback={deleteSelected} disabled={!selectedPolygon} />
    </div>
    <div class="border border-(--border) rounded-lg overflow-hidden relative h-150">
        <div class="overflow-hidden flex justify-center h-full">
            <canvas
                bind:this={mainBitmapMeta.canvas}
                class="h-full w-full cursor-grab touch-none"
                class:cursor-crosshair={addMode}
                class:cursor-grab={!addMode}
                onpointerdown={pointerDown}
                onpointermove={pointerMove}
                onpointerup={pointerUp}
                onwheel={handleWheel}
            ></canvas>
            <div class="absolute flex justify-center bottom-2 right-2 border-2 border-(--primary) rounded shadow-lg bg-(--background)/90 w-40 h-56">
                <canvas class="block cursor-pointer w-full h-full" bind:this={miniBitmapMeta.canvas} onclick={clickMinimap}></canvas>
            </div>
        </div>
    </div>
    <div class="mt-2 flex items-center justify-end text-sm text-(--muted-foreground)">
        <p class="text-xs">{ $t('editor.zoom_help', { values: {percentage: scalePercentage} }) }</p>
    </div>
</div>