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

	// AI segmentation now runs automatically on every upload (see
	// SessionService.uploadFile) -- this button no longer re-uploads or
	// re-triggers it. It only watches the pipeline's current/live status.
	// Points get applied the moment the result arrives -- no separate
	// "Done!"/confirm-to-load step. The only confirmation asked for is
	// up front, before watching even starts, and only when there's
	// something to actually lose (existing points on this projection).
	let magicStatus = $state<AutofillStatus>('idle');
	let magicError = $state<string | null>(null);

	// Which (if any) in-app confirm card is currently showing. Both the
	// Autofill overwrite warning and the "Clear all" action route through the
	// same ConfirmCard component instead of the native browser confirm().
	let activeConfirm = $state<'overwrite-ai' | 'clear-all' | null>(null);

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

			projectionContainer.edit.history?.push();
			proj.polygons = result;
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

	function handleClearAllClick() {
		activeConfirm = 'clear-all';
	}

	function commitClearAll() {
		const proj = project.session.projections[projection];
		projectionContainer.edit.history?.push();
		proj.polygons = [];
		projectionContainer.edit.selectedPolygon = null;
		project.session.requestSave();
		activeConfirm = null;
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
		// and zoomToFit() -- which recomputes the "contain" scale/offset for
		// the current canvas size -- was never otherwise re-invoked on its
		// own. Without this, resizing the viewport (e.g. opening devtools)
		// left the view's scale/offset stale for the old canvas size, so the
		// image visibly shrank/misaligned instead of staying correctly
		// contained at its own aspect ratio.
		const resizeObserver = new ResizeObserver(() => {
			projectionContainer.nav.zoomToFit();
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
		const { mainCanvas, miniCanvas, edit, nav } = projectionContainer;
		if (!project.session.projections[projection].patient?.study.series.sopInstance.bitmap) return;

		// Main Canvas Rendering
		if (mainCanvas) {
			const ctx = mainCanvas.getContext('2d')!;
			drawMain(
				ctx,
				project.session.projections[projection].patient?.study.series.sopInstance.bitmap,
				project.session.projections[projection].polygons,
				edit.selectedPolygon,
				edit.draftPoints,
				nav.view
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

<div
	class="flex flex-col gap-2 rounded-xl border border-(--border) bg-(--card) p-4 text-(--card-foreground)"
>
	<h3 class="font-semibold">
		{projection_h[$locale && $locale in projection_h ? $locale : 'en'][projection]}
	</h3>
	<div class="flex flex-wrap justify-start gap-x-2 gap-y-2">
		<Button
			type="back"
			callback={projectionContainer.edit.history!.undo}
			disabled={!projectionContainer.edit.history!.canUndo}
		/>
		<Button
			type="forward"
			callback={projectionContainer.edit.history!.redo}
			disabled={!projectionContainer.edit.history!.canRedo}
		/>
		<Button
			type="magic"
			callback={() => {
				handleMagicClick();
			}}
			disabled={magicStatus !== 'idle' && magicStatus !== 'error'}>{$t('editor.autofill')}</Button
		>
		<Button
			type="zoom-in"
			callback={() => {
				projectionContainer.nav.zoomToCenter(1.1);
			}}
		/>
		<Button
			type="zoom-out"
			callback={() => {
				projectionContainer.nav.zoomToCenter(0.9);
			}}
		/>
		{#if projectionContainer.edit.mode == 'draw'}
			<Button
				type="cancel"
				callback={() => {
					projectionContainer.edit.setMode('default');
				}}
				disabled={false}>{$t('editor.cancel')}</Button
			>
		{:else}
			<Button
				type="add"
				callback={() => {
					projectionContainer.edit.setMode('draw');
				}}
				disabled={false}
			/>
		{/if}
		<Button
			type="delete"
			callback={projectionContainer.edit.deleteSelected}
			disabled={!projectionContainer.edit.selectedPolygon}
		/>
		<Button
			type="delete"
			callback={handleClearAllClick}
			disabled={project.session.projections[projection].polygons.length === 0}
			>{$t('editor.clear_all')}</Button
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
		{:else if activeConfirm === 'clear-all'}
			<ConfirmCard
				message={$t('editor.clear_all_confirm')}
				continueLabel={$t('editor.continue')}
				continueButtonType="delete"
				onCancel={() => (activeConfirm = null)}
				onContinue={commitClearAll}
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
				class="h-full w-full touch-none {projectionContainer.edit.cursor}"
				onpointerdown={(e) => {
					projectionContainer.edit.handlePointerDown(e);
					projectionContainer.nav.handlePointerDown(e);
				}}
				onpointermove={(e) => {
					projectionContainer.edit.handlePointerMove(e);
					projectionContainer.nav.handlePointerMove(e);
				}}
				onpointerup={(e) => {
					projectionContainer.edit.handlePointerUp(e);
					projectionContainer.nav.handlePointerUp(e);
				}}
				onwheel={(e) => {
					projectionContainer.nav.handleWheel(e);
				}}
			></canvas>
			<div
				class="absolute right-2 bottom-2 flex h-56 w-40 justify-center rounded border-2 border-(--primary) bg-(--background)/90 shadow-lg"
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
