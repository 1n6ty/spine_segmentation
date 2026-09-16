<script lang="ts">
	import { t } from 'svelte-i18n';
	import type { DisplayController } from '$lib/features/editor/core/controllers/display.svelte';
	import { drawVoiPad } from '$lib/features/editor/rendering/voi-pad-draw';

	/**
	 * Collapsible "view settings" section placed at the bottom of a projection card (after the
	 * zoom-help footer) -- deliberately not a popover, so it needs no outside-click/Escape
	 * handling and just pushes the card taller while open. Collapsed by default: zero extra
	 * height until the user opens it. Header and content share one card (not two visually
	 * separate boxes) -- the header just gets a bottom divider once expanded.
	 */
	let { display }: { display: DisplayController } = $props();

	let voiPadWrapper = $state<HTMLDivElement | undefined>(undefined);
	let voiCanvas = $state<HTMLCanvasElement | undefined>(undefined);
	let canvasSize = $state({ width: 0, height: 0 });

	// Tied to `voiCanvas`'s presence (not `onMount`) since the canvas is only in the DOM while
	// `expanded` -- Svelte resets `voiCanvas` to undefined on unmount, re-running this effect to
	// tear down/re-attach the observer across every collapse/expand.
	$effect(() => {
		if (!voiCanvas) return;
		const canvas = voiCanvas;
		const resizeObserver = new ResizeObserver(() => {
			canvasSize = { width: canvas.clientWidth, height: canvas.clientHeight };
		});
		resizeObserver.observe(canvas);
		canvasSize = { width: canvas.clientWidth, height: canvas.clientHeight };
		return () => resizeObserver.disconnect();
	});

	$effect(() => {
		if (!voiCanvas) return;
		void canvasSize;
		const ctx = voiCanvas.getContext('2d');
		if (ctx) drawVoiPad(ctx, display.padFraction);
	});

	function onVoiPointerDown(e: PointerEvent) {
		if (!voiCanvas) return;
		// This pad sits inside EditorCanvas.svelte's own card, which has its OWN pointerdown/click
		// handlers that unconditionally focus the CARD (so its keyboard shortcuts -- Delete, arrow
		// keys nudging the selection, etc. -- stay reachable after clicking anywhere in it). Those
		// handlers are on an ANCESTOR and fire during the bubble phase, i.e. AFTER this one --
		// left alone, they'd steal focus right back to the card the instant it bubbles past here,
		// undoing the explicit focus() below. Stopping propagation keeps this interaction (and the
		// arrow-key handling it enables) scoped to the pad itself, which is also the semantically
		// correct behavior: arrow keys here should adjust brightness/contrast, not nudge whatever
		// vertebra happens to be selected on the canvas.
		e.stopPropagation();
		voiPadWrapper?.focus();
		display.beginWindowDrag(e, voiCanvas.getBoundingClientRect());
	}
	function onVoiPointerMove(e: PointerEvent) {
		if (!voiCanvas) return;
		display.updateWindowDrag(e, voiCanvas.getBoundingClientRect());
	}
	function onVoiPointerUp(e: PointerEvent) {
		display.endWindowDrag(e);
	}
	function onVoiClick(e: MouseEvent) {
		// The synthetic `click` fired after pointerup is a SEPARATE event from `pointerdown` above
		// and bubbles independently -- without this, the card's own `onclick` handler (see
		// onVoiPointerDown's comment) would still steal focus back a moment later.
		e.stopPropagation();
	}

	function onVoiKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case 'ArrowRight':
				e.preventDefault();
				display.nudgeBrightness(1);
				break;
			case 'ArrowLeft':
				e.preventDefault();
				display.nudgeBrightness(-1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				display.nudgeContrast(1);
				break;
			case 'ArrowDown':
				e.preventDefault();
				display.nudgeContrast(-1);
				break;
		}
	}
</script>

<div class="mt-2 rounded-xl border border-(--border) bg-(--card) text-(--card-foreground)">
	<button
		type="button"
		class="flex w-full items-center justify-between px-3 py-1.5 text-sm font-medium text-(--foreground) transition-all outline-none hover:bg-(--accent) hover:text-(--accent-foreground) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50 {display.panelExpanded
			? 'rounded-t-xl'
			: 'rounded-xl'}"
		aria-expanded={display.panelExpanded}
		onclick={() => (display.panelExpanded = !display.panelExpanded)}
	>
		<span>{$t('editor.view_settings.header')}</span>
		<span class="transition-transform {display.panelExpanded ? 'rotate-180' : ''}">&#9662;</span>
	</button>

	{#if display.panelExpanded}
		<div class="flex flex-col gap-3 border-t border-(--border) p-3">
			<label class="flex flex-col gap-1 text-xs text-(--muted-foreground)">
				{$t('editor.view_settings.opacity_label')}
				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={display.overlayOpacity}
					oninput={(e) => display.setOpacity(Number(e.currentTarget.value))}
					class="w-full"
				/>
			</label>

			<div class="flex flex-col items-center gap-1">
				<span class="self-start text-xs text-(--muted-foreground)"
					>{$t('editor.view_settings.voi_label')}</span
				>
				<span class="text-[10px] text-(--muted-foreground)"
					>{$t('editor.view_settings.contrast_axis_label')}</span
				>
				<!--
					A custom keyboard-driven 2D control (drag OR arrow keys adjust brightness/contrast)
					has no fitting native ARIA role, hence `role="application"` -- same choice
					EditorCanvas.svelte's own card makes for the same reason.
				-->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div
					bind:this={voiPadWrapper}
					class="h-28 w-28 overflow-hidden rounded border border-(--border) outline-none focus-visible:ring-[3px] focus-visible:ring-(--ring)/50"
					role="application"
					tabindex="0"
					aria-label={$t('editor.view_settings.voi_aria_label')}
					onkeydown={onVoiKeydown}
				>
					<canvas
						bind:this={voiCanvas}
						class="h-full w-full cursor-crosshair touch-none"
						onpointerdown={onVoiPointerDown}
						onpointermove={onVoiPointerMove}
						onpointerup={onVoiPointerUp}
						onclick={onVoiClick}
					></canvas>
				</div>
				<span class="text-[10px] text-(--muted-foreground)"
					>{$t('editor.view_settings.brightness_axis_label')}</span
				>
				<div class="flex w-full items-center justify-between text-xs text-(--muted-foreground)">
					<span>
						{$t('editor.view_settings.voi_readout', {
							values: {
								brightness: Math.round(display.brightnessFraction * 100),
								contrast: Math.round(display.contrastFraction * 100)
							}
						})}
					</span>
					<button
						type="button"
						class="rounded-md border border-(--border) bg-(--background) px-2 py-0.5 text-xs transition-all hover:bg-(--accent) hover:text-(--accent-foreground)"
						onclick={() => display.resetWindow()}
					>
						{$t('editor.view_settings.reset')}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
