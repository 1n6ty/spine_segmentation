<script lang="ts">
	import { locale, t } from 'svelte-i18n';
	import { onMount } from 'svelte';

	import loaderSVG from '$lib/assets/icons/loader.svg';

	import Button from '$lib/components/ui/button/Button.svelte';
	import ConfirmCard from '$lib/components/ui/ConfirmCard.svelte';

	import { InstanceContainer } from '$lib/features/editor/core/instance-container.svelte';
	import { project } from '$lib/core/project.svelte';
	import { drawMain } from '$lib/features/editor/rendering/main-draw';
	import { drawMinimap } from '$lib/features/editor/rendering/minimap-draw';
	import { watchAutofillStatus, type AutofillStatus } from '$lib/features/autofill/autofill';

	let {
		projection = 'side'
	}: {
		projection: 'side' | 'frontal';
	} = $props();

	// The keyboard-shortcut scope is this whole card (see the wrapping <div> below), not just
	// the canvas -- bound here so its own pointerdown/focus-fallback handler can reach it.
	let cardEl: HTMLDivElement | undefined;

	const MAX_VERTEBRAE = 24;

	// AI segmentation now runs automatically on every upload (see
	// SessionService.uploadFile) -- this button no longer re-uploads or
	// re-triggers it. It only watches the pipeline's current/live status.
	// Points get applied the moment the result arrives -- no separate
	// "Done!"/confirm-to-load step. The only confirmation asked for is
	// up front, before watching even starts, and only when there's
	// something to actually lose (existing points on this projection).
	let magicStatus = $state<AutofillStatus>('idle');
	let magicError = $state<string | null>(null);

	// Which (if any) in-app confirm card is currently showing. The Autofill
	// overwrite warning routes through the shared ConfirmCard component
	// instead of the native browser confirm().
	let activeConfirm = $state<'overwrite-ai' | null>(null);

	function handleMagicClick() {
		const proj = project.session.projections[projection];
		if (!proj.patient?.study.series.sopInstance.sopInstanceUID) return;

		if (proj.polygons.length > 0) {
			activeConfirm = 'overwrite-ai';
			return;
		}

		runAutofillWatch();
	}

	async function runAutofillWatch() {
		const proj = project.session.projections[projection];
		const sopInstanceUID = proj.patient?.study.series.sopInstance.sopInstanceUID;
		if (!sopInstanceUID) return;

		magicError = null;
		magicStatus = 'checking';

		try {
			const result = await watchAutofillStatus(sopInstanceUID, (status) => {
				magicStatus = status;
			});

			projectionContainer.tools.history.push();
			proj.polygons = result;
			projectionContainer.tools.selection.clear();
			project.session.requestSave();
			magicStatus = 'idle';
		} catch (err) {
			magicStatus = 'error';
			magicError = err instanceof Error ? err.message : String(err);
		}
	}

	function closeMagic() {
		magicStatus = 'idle';
		magicError = null;
	}

	// Keyboard equivalents for the toolbar -- bound on the whole card <div> (not
	// `<svelte:window>`), so shortcuts fire while focus is anywhere inside THIS projection's
	// card (toolbar buttons, canvas, or the card's own background/chrome), via normal keydown
	// bubbling. With both 'side' and 'frontal' cards mounted at once, a window-level listener
	// would fire for both simultaneously on every keypress; scoping to the card is what keeps
	// them independent, and pairing it with `tabindex="0"` on the card (below) is what makes
	// the whole widget keyboard/click-focusable in the first place.
	function handleCanvasKeydown(e: KeyboardEvent) {
		if (e.altKey) return;
		const mod = e.ctrlKey || e.metaKey;

		if (mod) {
			switch (e.key.toLowerCase()) {
				case 'z':
					e.preventDefault();
					if (e.shiftKey) projectionContainer.tools.history.redo();
					else projectionContainer.tools.history.undo();
					return;
				case 'y':
					e.preventDefault();
					projectionContainer.tools.history.redo();
					return;
				case 'a':
					e.preventDefault();
					projectionContainer.tools.selection.replaceWithMany(
						project.session.projections[projection].polygons.map((p) => ({
							kind: 'vertebra' as const,
							polygonUuid: p.uuid
						}))
					);
					return;
				case '0':
					e.preventDefault();
					projectionContainer.nav.zoomToFit();
					return;
			}
			// Any other modified combo (e.g. Ctrl+V) is left alone -- fall through to nothing
			// rather than risk matching one of the bare-letter tool shortcuts below.
			return;
		}

		switch (e.key) {
			case 'Delete':
			case 'Backspace':
				// Always prevent-default while the canvas has focus, even with nothing
				// selected -- otherwise Backspace can trigger browser back-navigation.
				e.preventDefault();
				if (!projectionContainer.tools.selection.isEmpty) {
					projectionContainer.tools.deleteSelected();
				}
				return;
			case 'ArrowUp':
			case 'ArrowDown':
			case 'ArrowLeft':
			case 'ArrowRight': {
				if (projectionContainer.tools.selection.isEmpty) return;
				e.preventDefault();
				const step = e.shiftKey ? 10 : 1;
				const deltaByKey: Record<string, [number, number]> = {
					ArrowUp: [0, -step],
					ArrowDown: [0, step],
					ArrowLeft: [-step, 0],
					ArrowRight: [step, 0]
				};
				const [dx, dy] = deltaByKey[e.key];
				projectionContainer.tools.nudgeSelected(dx, dy);
				return;
			}
			case 'Escape':
				if (projectionContainer.tools.activeToolId === 'draw') {
					projectionContainer.tools.setActiveTool('select');
				} else {
					projectionContainer.tools.selection.clear();
				}
				return;
			case 'v':
			case 'V':
				projectionContainer.tools.setActiveTool('select');
				return;
			case 'h':
			case 'H':
				projectionContainer.tools.setActiveTool('pan');
				return;
			case 'a':
			case 'A':
				if (project.session.projections[projection].polygons.length < MAX_VERTEBRAE) {
					projectionContainer.tools.setActiveTool('draw');
				}
				return;
			case '+':
			case '=':
				e.preventDefault();
				projectionContainer.nav.zoomToCenter(1.1);
				return;
			case '-':
				e.preventDefault();
				projectionContainer.nav.zoomToCenter(0.9);
				return;
		}
	}

	const projection_h: Record<string, Record<string, string>> = {
		'en-US': {
			side: 'Lateral View',
			frontal: 'Frontal View'
		},
		'ru-RU': {
			side: 'Сагиттальная Проекция',
			frontal: 'Фронтальная Проекция'
		}
	} as const;

	const projectionContainer = $derived(new InstanceContainer(projection, project.session));

	onMount(() => {
		projectionContainer.nav.zoomToFit();

		// The canvas's backing-store size only gets re-synced as a side effect
		// of the next redraw (drawBackground() in main-draw.ts sets
		// canvas.width/height = canvas.clientWidth/clientHeight every draw),
		// and nothing was otherwise re-invoked when the viewport resized (e.g.
		// opening devtools, or the window itself resizing) -- the view's
		// scale/offset were left stale for the old canvas size, misaligning
		// the image. `syncToViewportSize()` re-adapts to the new size WITHOUT
		// resetting the user's chosen zoom/pan the way `zoomToFit()` would --
		// that would otherwise snap back to 100%-fit on every resize.
		const resizeObserver = new ResizeObserver(() => {
			projectionContainer.nav.syncToViewportSize();
		});
		if (projectionContainer.mainCanvas) {
			resizeObserver.observe(projectionContainer.mainCanvas);
		}

		return () => resizeObserver.disconnect();
	});

	$effect(() => {
		const bitmap = project.session.projections[projection].patient?.study.series.sopInstance.bitmap;
		const canvas = projectionContainer.mainCanvas;

		if (bitmap && canvas) {
			requestAnimationFrame(() => {
				projectionContainer.nav.zoomToFit();
			});
		}
	});

	$effect(() => {
		const { mainCanvas, miniCanvas, tools, nav, centralLine } = projectionContainer;
		if (!project.session.projections[projection].patient?.study.series.sopInstance.bitmap) return;

		// Main Canvas Rendering
		if (mainCanvas) {
			const ctx = mainCanvas.getContext('2d')!;
			drawMain(
				ctx,
				project.session.projections[projection].patient?.study.series.sopInstance.bitmap,
				project.session.projections[projection].polygons,
				tools.selection.all,
				tools.draftPoints,
				nav.view,
				tools.selectionBox,
				6,
				centralLine.centralPath
			);
		}

		// Minimap Rendering
		if (miniCanvas) {
			const ctx = miniCanvas.getContext('2d')!;
			drawMinimap(
				ctx,
				project.session.projections[projection].patient?.study.series.sopInstance.bitmap,
				nav.view,
				{ width: mainCanvas?.width ?? 0, height: mainCanvas?.height ?? 0 }
			);
		}
	});
</script>

<!--
	This is a custom keyboard-driven composite widget (an image-editing canvas plus its
	toolbar), which is exactly what `role="application"` exists for; the linter's role
	taxonomy just doesn't classify "application" as "interactive enough" to license
	tabindex + handlers on its own, hence the two ignores below.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={cardEl}
	class="flex flex-col gap-2 rounded-xl border border-(--border) bg-(--card) p-4 text-(--card-foreground) outline-none focus-visible:ring-[3px] focus-visible:ring-(--ring)/50"
	role="application"
	tabindex="0"
	aria-label={$t('editor.canvas_aria_label', {
		values: {
			view: projection_h[$locale && $locale in projection_h ? $locale : 'en'][projection]
		}
	})}
	onpointerdown={() => {
		// Clicking ANYWHERE in the card -- not just the canvas -- should be enough to
		// enable the keyboard shortcuts below. A click that lands on something with its
		// own focus behavior (a toolbar button) still wins in the end here: the browser's
		// default mousedown-focus action for that element runs after this pointerdown
		// handler, so it simply overrides this call. This only "sticks" for clicks on
		// otherwise non-focusable card chrome (background, heading, help text, canvas).
		cardEl?.focus();
	}}
	onclick={() => {
		// Several toolbar buttons become `disabled` as a direct result of being clicked
		// (Undo once the stack empties, Delete once the selection clears, Add-vertebra at
		// the 24-vertebra cap, Autofill entering its "checking" state) -- and a browser
		// auto-blurs a focused element the instant it goes disabled, dropping focus out of
		// the card entirely so keydowns have nothing left to bubble from. `click` fires
		// after the whole mousedown-focus-then-maybe-disable sequence has already played
		// out, so re-focusing the card here reliably wins regardless of what happened to
		// whatever was actually clicked.
		cardEl?.focus();
	}}
	onkeydown={handleCanvasKeydown}
>
	<h3 class="font-semibold">
		{projection_h[$locale && $locale in projection_h ? $locale : 'en'][projection]}
	</h3>
	<div class="flex flex-wrap justify-start gap-x-2 gap-y-2">
		<Button
			type="back"
			shortcut="Ctrl+Z"
			callback={projectionContainer.tools.history.undo}
			disabled={!projectionContainer.tools.history.canUndo}
		/>
		<Button
			type="forward"
			shortcut="Ctrl+Shift+Z"
			callback={projectionContainer.tools.history.redo}
			disabled={!projectionContainer.tools.history.canRedo}
		/>
		<Button
			type="zoom-in"
			shortcut="+"
			callback={() => {
				projectionContainer.nav.zoomToCenter(1.1);
			}}
		/>
		<Button
			type="zoom-out"
			shortcut="-"
			callback={() => {
				projectionContainer.nav.zoomToCenter(0.9);
			}}
		/>
		<Button
			type="select"
			shortcut="V"
			active={projectionContainer.tools.activeToolId === 'select'}
			callback={() => {
				projectionContainer.tools.setActiveTool('select');
			}}
		/>
		<Button
			type="pan"
			shortcut="H"
			active={projectionContainer.tools.activeToolId === 'pan'}
			callback={() => {
				projectionContainer.tools.setActiveTool('pan');
			}}
		/>
	</div>
	<div class="flex flex-wrap justify-start gap-x-2 gap-y-2">
		<Button
			type="magic"
			callback={() => {
				handleMagicClick();
			}}
			disabled={magicStatus !== 'idle' && magicStatus !== 'error'}>{$t('editor.autofill')}</Button
		>
		{#if projectionContainer.tools.activeToolId == 'draw'}
			<Button
				type="cancel"
				shortcut="Esc"
				callback={() => {
					projectionContainer.tools.setActiveTool('select');
				}}
				disabled={false}>{$t('editor.cancel')}</Button
			>
		{:else}
			<Button
				type="add"
				shortcut="A"
				callback={() => {
					projectionContainer.tools.setActiveTool('draw');
				}}
				disabled={project.session.projections[projection].polygons.length >= MAX_VERTEBRAE}
				>{$t('editor.add_vertebra')}</Button
			>
		{/if}
		<Button
			type="delete"
			shortcut="Delete"
			callback={projectionContainer.tools.deleteSelected}
			disabled={projectionContainer.tools.selection.isEmpty}>{$t('editor.delete_selected')}</Button
		>
	</div>
	<div class="relative h-150 overflow-hidden rounded-lg border border-(--border)">
		{#if activeConfirm === 'overwrite-ai'}
			<ConfirmCard
				message={$t('editor.autofill_confirm_overwrite')}
				continueLabel={$t('editor.continue')}
				continueButtonType="magic"
				onCancel={() => (activeConfirm = null)}
				onContinue={() => {
					activeConfirm = null;
					runAutofillWatch();
				}}
			/>
		{:else if magicStatus !== 'idle'}
			<div
				class="absolute inset-0 z-50 flex items-center justify-center bg-(--background)/50 backdrop-blur-sm"
			>
				<div
					class="flex flex-col items-center gap-4 rounded-xl border border-(--border) bg-(--card) p-6 text-(--card-foreground) shadow-lg"
				>
					{#if magicStatus === 'error'}
						<span class="text-sm font-medium text-(--destructive)"
							>{magicError ?? $t('editor.loading.error')}</span
						>
						<Button type="cancel" callback={closeMagic}>{$t('editor.cancel')}</Button>
					{:else}
						<img src={loaderSVG} alt="loader" class="h-12 w-12" />
						<span class="text-sm font-medium">{$t('editor.loading.' + magicStatus)}</span>
					{/if}
				</div>
			</div>
		{/if}
		<div class="flex h-full justify-center overflow-hidden">
			<canvas
				bind:this={projectionContainer.mainCanvas}
				class="h-full w-full touch-none {projectionContainer.tools.cursor}"
				onpointerdown={(e) => {
					projectionContainer.tools.handlePointerDown(e);
				}}
				onpointermove={(e) => {
					projectionContainer.tools.handlePointerMove(e);
				}}
				onpointerup={(e) => {
					projectionContainer.tools.handlePointerUp(e);
				}}
				onwheel={(e) => {
					projectionContainer.nav.handleWheel(e);
				}}
			></canvas>
			<div
				class="absolute right-2 bottom-2 flex h-32 w-24 justify-center rounded border-2 border-(--primary) bg-(--background)/90 shadow-lg"
			>
				<canvas
					class="block h-full w-full cursor-pointer"
					bind:this={projectionContainer.miniCanvas}
					onpointerdown={(e) => {
						projectionContainer.nav.jumpToMinimap(e);
					}}
				></canvas>
			</div>
		</div>
	</div>
	<div class="mt-2 flex items-center justify-end text-sm text-(--muted-foreground)">
		<p class="text-xs">
			{$t('editor.zoom_help', { values: { percentage: projectionContainer.nav.scalePercentage } })}
		</p>
	</div>
</div>
