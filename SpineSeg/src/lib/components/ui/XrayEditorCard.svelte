<script lang="ts">
    import { onMount } from "svelte";
    import { locale, t } from "svelte-i18n";

	import Button from "$lib/components/ui/Button.svelte";

    import magicSVG from "$lib/assets/magic.svg";
    import backSVG from "$lib/assets/back.svg";
    import forwardSVG from "$lib/assets/forward.svg";

	import { createDicomBitmap } from "$lib/utils/dicom";
	import { dicomStore } from "$lib/stores/dicom/dicom.store";
	import { currentPatientStore } from "$lib/stores/patient/patient.store";

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
    let scale = 1;
    let minScale = 0.1;
    let maxScale = 5, max_scale_coef = 15;

    let offsetX = 0;
    let offsetY = 0;

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    /* -----------------------------
    Polygon State
    ------------------------------ */
    type Point = { x: number; y: number };

    type Polygon = {
        id: string;
        points: Point[];
    };

    let polygons: Polygon[] = [];

    let currentPoints: Point[] = [];
    let polygonCounter = 1;
    let selectedPolygon: Polygon | null = $state(null);
    let addMode: boolean = $state(false);

    let draggingPoint: { poly: Polygon; index: number } | null = null;
    const pointRadius = 6;
    const pointHitRadius = 12

    /* -----------------------------
    Canvas references
    ------------------------------ */
    let mainCanvas: HTMLCanvasElement;
    let minimapCanvas: HTMLCanvasElement;

    let ctx: CanvasRenderingContext2D;
    let miniCtx: CanvasRenderingContext2D;

    let dicomBitmap: ImageBitmap | null = $state(null);

    function resizeCanvas() {
        if (!mainCanvas) return;
        const rect = mainCanvas.getBoundingClientRect();
        
        // Sync internal buffer to display size
        mainCanvas.width = rect.width;
        mainCanvas.height = rect.height;

        if (dicomBitmap) {
            const ratio = Math.min(
                mainCanvas.width / dicomBitmap.width,
                mainCanvas.height / dicomBitmap.height
            );

            scale = ratio;
            offsetX = (mainCanvas.width - dicomBitmap.width * ratio) / 2;
            offsetY = (mainCanvas.height - dicomBitmap.height * ratio) / 2;

            minScale = ratio;
            maxScale = ratio * max_scale_coef;
        }
    }

    function clampOffset() {
        if (!dicomBitmap) return;
        
        // X axis
        if (dicomBitmap.width * scale < mainCanvas.width) {
            offsetX = (mainCanvas.width - dicomBitmap.width * scale) / 2;
        } else {
            offsetX = Math.min(0, Math.max(offsetX, mainCanvas.width - dicomBitmap.width * scale));
        }

        // Y axis
        if (dicomBitmap.height * scale < mainCanvas.height) {
            offsetY = (mainCanvas.height - dicomBitmap.height * scale) / 2;
        } else {
            offsetY = Math.min(0, Math.max(offsetY, mainCanvas.height - dicomBitmap.height * scale));
        }
    }

    function resizeMinimap() {
        const rect = minimapCanvas.getBoundingClientRect();
        minimapCanvas.width = rect.width;
        minimapCanvas.height = rect.height;
        drawMinimap();
    }

    $effect(() => {
        const patient = $dicomStore.patients[$currentPatientStore.currentPatientID];
        const study = patient?.studies[$currentPatientStore.currentStudyUID];
        const series = study?.series[$currentPatientStore.currentSeriesUID];
        const imageData = series?.images[$currentPatientStore.projectionsSopUID[projection]];

        if (imageData) {
            (async () => {
                // Generate bitmap
                const bitmap = await createDicomBitmap(imageData);
                
                // Update state
                dicomBitmap = bitmap;
                
                // Recalculate everything now that we have the bitmap
                resizeCanvas();
                resizeMinimap();
                draw();
            })();
        }
    });

    onMount(() => {
        ctx = mainCanvas.getContext("2d")!;
        miniCtx = minimapCanvas.getContext("2d")!;
        
        resizeCanvas();
        resizeMinimap();

        window.addEventListener("resize", () => {
            resizeCanvas();
            resizeMinimap();
            draw();
        });
    });

    /* -----------------------------
    Coordinate helpers
    ------------------------------ */
    function screenToWorld(x: number, y: number): Point {
        return {
            x: (x - offsetX) / scale,
            y: (y - offsetY) / scale
        };
    }

    /* -----------------------------
    Drawing
    ------------------------------ */
    function draw() {
        if (!dicomBitmap || !ctx) return; // Guard clause
        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);

        // Drawing the bitmap is identical to drawing an image
        ctx.drawImage(dicomBitmap, 0, 0);

        drawPolygons(ctx);
        ctx.restore();
        drawMinimap();
    }

    function drawPolygons(context: CanvasRenderingContext2D) {
        context.lineWidth = 2 / scale;

        for (const poly of polygons) {
            context.beginPath();
            poly.points.forEach((p, i) => {
                if (i === 0) context.moveTo(p.x, p.y);
                else context.lineTo(p.x, p.y);
            });
            context.closePath();

            context.strokeStyle = poly.id === selectedPolygon?.id ? "red" : "lime";
            context.stroke();

            // Compute left-most point for label
            const minX = Math.min(...poly.points.map(p => p.x));
            const centerY = getPolygonCenter(poly).y;

            context.fillStyle = "yellow";
            context.font = `${22 / scale}px sans-serif`;
            context.textAlign = "right"; // align text to the left of minX
            context.textBaseline = "middle"; // vertically centered
            context.fillText(poly.id, minX - 5 / scale, centerY); // 5px padding left
        }

        // Draw current creating polygon
        if (currentPoints.length > 0) {
            context.beginPath();
            currentPoints.forEach((p, i) => {
                if (i === 0) context.moveTo(p.x, p.y);
                else context.lineTo(p.x, p.y);
            });
            context.strokeStyle = "cyan";
            context.stroke();
        }
        for (const p of currentPoints) {
            context.beginPath();
            context.arc(p.x, p.y, pointRadius / scale, 0, Math.PI * 2);
            context.fillStyle = "cyan";
            context.fill();
            context.strokeStyle = "black";
            context.lineWidth = 1 / scale;
            context.stroke();
        }

        for (const poly of polygons) {
            for (let i = 0; i < poly.points.length; i++) {
                const p = poly.points[i];
                ctx.beginPath();
                ctx.arc(p.x, p.y, pointRadius / scale, 0, Math.PI * 2);
                ctx.fillStyle = poly.id === selectedPolygon?.id ? "red" : "lime";
                ctx.fill();
                ctx.strokeStyle = "black";
                ctx.lineWidth = 1 / scale;
                ctx.stroke();
            }
        }
    }

    function getPointUnderCursor(x: number, y: number): { poly: Polygon; index: number } | null {
        // Check points of completed polygons (top-most first)
        for (let i = polygons.length - 1; i >= 0; i--) {
            const poly = polygons[i];
            for (let j = 0; j < poly.points.length; j++) {
                const p = poly.points[j];
                const px = p.x * scale + offsetX;
                const py = p.y * scale + offsetY;
                const dx = px - x;
                const dy = py - y;
                if (Math.sqrt(dx*dx + dy*dy) < pointHitRadius) {
                    return { poly, index: j };
                }
            }
        }

        // Optional: include currentPoints if polygon being drawn
        for (let j = 0; j < currentPoints.length; j++) {
            const p = currentPoints[j];
            const px = p.x * scale + offsetX;
            const py = p.y * scale + offsetY;
            const dx = px - x;
            const dy = py - y;
            if (Math.sqrt(dx*dx + dy*dy) < pointHitRadius) {
                return { poly: { id: "current", points: currentPoints }, index: j };
            }
        }

        return null;
    }

    function getPolygonUnderCursor(x: number, y: number): Polygon | null {
        // Check completed polygons (top-most first)
        for (let i = polygons.length - 1; i >= 0; i--) {
            const poly = polygons[i];
            // Simple bounding box check
            const xs = poly.points.map(p => p.x * scale + offsetX);
            const ys = poly.points.map(p => p.y * scale + offsetY);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                return poly;
            }
        }
        return null;
    }



    function getPolygonCenter(poly: Polygon): Point {
        const sum = poly.points.reduce(
            (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
            { x: 0, y: 0 }
        );
        return {
            x: sum.x / poly.points.length,
            y: sum.y / poly.points.length
        };
    }

    /* -----------------------------
    Minimap
    ------------------------------ */
    function drawMinimap() {
        if (!dicomBitmap || !miniCtx) return;
        miniCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

        const ratio = Math.min(
            minimapCanvas.width / dicomBitmap.width,
            minimapCanvas.height / dicomBitmap.height
        );

        const imageOffsetX = (minimapCanvas.width - dicomBitmap.width * ratio) / 2;
        const imageOffsetY = (minimapCanvas.height - dicomBitmap.height * ratio) / 2;

        miniCtx.drawImage(
            dicomBitmap,
            imageOffsetX,
            imageOffsetY,
            dicomBitmap.width * ratio,
            dicomBitmap.height * ratio
        );

        // Current viewport in world coordinates
        const viewWidth = mainCanvas.width / scale;
        const viewHeight = mainCanvas.height / scale;

        const worldX = -offsetX / scale;
        const worldY = -offsetY / scale;

        // Draw viewport rectangle (add image offsets!)
        miniCtx.strokeStyle = "red";
        miniCtx.strokeRect(
            imageOffsetX + worldX * ratio,
            imageOffsetY + worldY * ratio,
            viewWidth * ratio,
            viewHeight * ratio
        );
    }

    /* -----------------------------
    Zoom
    ------------------------------ */
    function zoomAtPoint(factor: number, clientX: number, clientY: number) {
        const rect = mainCanvas.getBoundingClientRect();

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Compute new scale first
        const newScale = Math.max(minScale, Math.min(maxScale, scale * factor));

        // World coordinates under cursor
        const worldX = (x - offsetX) / scale;
        const worldY = (y - offsetY) / scale;

        // Update scale
        scale = newScale;

        // Compute offset so cursor stays in place
        offsetX = x - worldX * scale;
        offsetY = y - worldY * scale;

        // Clamp after updating offset & scale
        clampOffset();

        draw();
    }

    function handleWheel(e: WheelEvent) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        zoomAtPoint(factor, e.clientX, e.clientY);
    }

    function zoomCenter(factor: number) {
        const rect = mainCanvas.getBoundingClientRect();
        zoomAtPoint(
            factor,
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
        );
    }

    function getEventClientXY(e: PointerEvent) {
        const rect = mainCanvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    /* -----------------------------
    Pan
    ------------------------------ */
    function pointerDown(e: PointerEvent) {
        e.preventDefault();
        mainCanvas.setPointerCapture(e.pointerId);

        const { x, y } = getEventClientXY(e);

        if (addMode) {
            addPoint(e);
            return;
        }

        const hitPoint = getPointUnderCursor(x, y);
        if (hitPoint) {
            draggingPoint = hitPoint;
            selectedPolygon = hitPoint.poly;
            draw();
            return;
        }

        const hitPoly = getPolygonUnderCursor(x, y);
        if (hitPoly) {
            selectedPolygon = hitPoly;
            draw();
            return;
        }

        selectedPolygon = null;

        isDragging = true;
        lastX = x;
        lastY = y;

        draw();
    }

    function pointerMove(e: PointerEvent) {
        e.preventDefault();
        const { x, y } = getEventClientXY(e);

        if (draggingPoint) {
            const world = screenToWorld(x, y);
            draggingPoint.poly.points[draggingPoint.index] = world;
            draw();
            return;
        }

        if (isDragging) {
            offsetX += x - lastX;
            offsetY += y - lastY;
            lastX = x;
            lastY = y;

            clampOffset();
            draw();
        }
    }

    function pointerUp(e: PointerEvent) {
        e.preventDefault();
        draggingPoint = null;
        isDragging = false;
        mainCanvas.releasePointerCapture(e.pointerId);
        draw();
    }


    /* -----------------------------
    Polygon creation
    ------------------------------ */
    function addPoint(e: PointerEvent) {
        const rect = mainCanvas.getBoundingClientRect();
        const world = screenToWorld(
            e.clientX - rect.left,
            e.clientY - rect.top
        );

        currentPoints.push(world);

        if (currentPoints.length === 4) {
            const newPoly: Polygon = {
                id: `P${polygonCounter++}`,
                points: [...currentPoints]
            };

            polygons.push(newPoly);
            selectedPolygon = newPoly;
            currentPoints = [];
            addMode = false;
        }

        draw();
    }



    function toggleAddMode() {
        // Exit add mode
        addMode = !addMode;

        // Discard any partially placed points
        currentPoints = [];

        draw(); // redraw to remove temporary points
    }

    function deleteSelected() {
        if (!selectedPolygon) return;

        polygons = polygons.filter(p => p.id !== selectedPolygon?.id);
        selectedPolygon = null;
        draw();
    }

    function clickMinimap(e: MouseEvent) {
        if (!dicomBitmap) return;

        const rect = minimapCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Compute image drawing ratio and offsets exactly like in drawMinimap
        const ratio = Math.min(
            minimapCanvas.width / dicomBitmap.width,
            minimapCanvas.height / dicomBitmap.height
        );

        const imageOffsetX = (minimapCanvas.width - dicomBitmap.width * ratio) / 2;
        const imageOffsetY = (minimapCanvas.height - dicomBitmap.height * ratio) / 2;

        // Mouse position relative to the image
        const relX = (mouseX - imageOffsetX) / ratio;
        const relY = (mouseY - imageOffsetY) / ratio;

        // Center the main canvas viewport on that point
        offsetX = -relX * scale + mainCanvas.width / 2;
        offsetY = -relY * scale + mainCanvas.height / 2;

        clampOffset();
        draw();
    }

</script>

<div class="bg-(--card) text-(--card-foreground) flex flex-col gap-2 rounded-xl border border-(--border) p-4">
    <h3 class="font-semibold">{ projection_h[$locale && $locale in projection_h ? $locale: 'en'][projection] }</h3>
    <div class="flex flex-wrap justify-start gap-x-2 gap-y-2">
        <button
        class="
            inline-flex items-center justify-center whitespace-nowrap
            text-sm font-medium transition-all
            disabled:pointer-events-none disabled:opacity-50 disabled:cursor-none
            not-disabled:cursor-pointer
            [&_img]:pointer-events-none
            [&_img:not([class*='size-'])]:size-4
            shrink-0 [&_img]:shrink-0
            outline-none focus-visible:border-(--ring)
            focus-visible:ring-(--ring)/50 focus-visible:ring-[3px]
            aria-invalid:ring-(--destructive)/20
            aria-invalid:border-(--destructive)
            border border-(--border)
            bg-(--background) text-(--foreground)
            hover:bg-(--accent) hover:text-(--accent-foreground)
            h-8 rounded-md gap-1.5 px-3 has-[>img]:px-2.5
        "
        title="back"
        >
            <img src={backSVG} alt="back icon"/>
        </button>
        <button
        class="
            inline-flex items-center justify-center whitespace-nowrap
            text-sm font-medium transition-all
            disabled:pointer-events-none disabled:opacity-50 disabled:cursor-none
            not-disabled:cursor-pointer
            [&_img]:pointer-events-none
            [&_img:not([class*='size-'])]:size-4
            shrink-0 [&_img]:shrink-0
            outline-none focus-visible:border-(--ring)
            focus-visible:ring-(--ring)/50 focus-visible:ring-[3px]
            aria-invalid:ring-(--destructive)/20
            aria-invalid:border-(--destructive)
            border border-(--border)
            bg-(--background) text-(--foreground)
            hover:bg-(--accent) hover:text-(--accent-foreground)
            h-8 rounded-md gap-1.5 px-3 has-[>img]:px-2.5
        "
        title="forward"
        >
            <img src={forwardSVG} alt="magic icon"/>
        </button>
        <button
        class="
            inline-flex items-center justify-center whitespace-nowrap
            text-sm font-medium transition-all
            disabled:pointer-events-none disabled:opacity-50 disabled:cursor-none
            not-disabled:cursor-pointer
            [&_img]:pointer-events-none
            [&_img:not([class*='size-'])]:size-4
            shrink-0 [&_img]:shrink-0
            outline-none focus-visible:border-(--ring)
            focus-visible:ring-(--ring)/50 focus-visible:ring-[3px]
            aria-invalid:ring-(--destructive)/20
            aria-invalid:border-(--destructive)
            border border-(--border)
            bg-(--background) text-(--foreground)
            hover:bg-(--accent) hover:text-(--accent-foreground)
            h-8 rounded-md gap-1.5 px-3 has-[>img]:px-2.5
        "
        title="magic"
        >
            <img src={magicSVG} alt="magic icon"/>
            Autofill
        </button>
        <Button type="zoom-in" callback={() => zoomCenter(1.1)} />
        <Button type="zoom-out" callback={() => zoomCenter(0.9)} />
        {#if addMode}
            <Button type="cancel" callback={toggleAddMode} disabled={false} >cancel</Button>
        {:else}
            <Button type="add-polygon" callback={toggleAddMode} disabled={false} />
        {/if}
        <Button type="delete-polygon" callback={deleteSelected} disabled={!selectedPolygon} />
    </div>
    <div class="border border-(--border) rounded-lg overflow-hidden relative h-150">
        <div class="overflow-hidden flex justify-center h-full">
            <canvas
                bind:this={mainCanvas}
                class="h-full w-full cursor-grab touch-none"
                class:cursor-crosshair={addMode}
                class:cursor-grab={!addMode}
                onpointerdown={pointerDown}
                onpointermove={pointerMove}
                onpointerup={pointerUp}
                onwheel={handleWheel}
            ></canvas>
            <div class="absolute flex justify-center bottom-2 right-2 border-2 border-(--primary) rounded shadow-lg bg-(--background)/90 w-40 h-56">
                <canvas class="block cursor-pointer w-full h-full" bind:this={minimapCanvas} onclick={clickMinimap}></canvas>
            </div>
        </div>
    </div>
    <div class="mt-2 flex items-center justify-end text-sm text-(--muted-foreground)">
        <p class="text-xs">{ $t('editor.projection.help', { values: {percentage: 100} }) }</p>
    </div>
</div>