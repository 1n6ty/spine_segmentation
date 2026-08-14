<script lang="ts">
	import { locale, t } from 'svelte-i18n';
	import { onMount } from 'svelte';

	import loaderSVG from '$lib/assets/icons/loader.svg';

	import Button from '$lib/components/ui/button/Button.svelte';

	import { InstanceContainer } from '$lib/features/editor/core/instance-container.svelte';
	import { project } from '$lib/core/project.svelte';
	import { drawMain } from '$lib/features/editor/rendering/main-draw';
	import { drawMinimap } from '$lib/features/editor/rendering/minimap-draw';
	import { runAutofill, type AutofillStatus } from '$lib/features/autofill/autofill';

	let {
		projection = 'side'
	}: {
		projection: 'side' | 'frontal';
	} = $props();

	let magicStatus = $state<AutofillStatus>('idle');
	let magicError = $state<string | null>(null);

	async function handleMagicClick() {
		const proj = project.session.projections[projection];
		const sopInstanceUID = proj.patient?.study.series.sopInstance.sopInstanceUID;
		const arrayBuffer = proj.arrayBuffer;

		if (!sopInstanceUID || !arrayBuffer) return;

		if (proj.polygons.length > 0 && !confirm($t('editor.autofill_confirm_overwrite'))) {
			return;
		}

		magicError = null;

		try {
			const polygons = await runAutofill(sopInstanceUID, arrayBuffer, projection, (status) => {
				magicStatus = status;
			});

			proj.polygons = polygons;
			project.session.requestSave();

			magicStatus = 'done';
			setTimeout(() => {
				magicStatus = 'idle';
			}, 800);
		} catch (err) {
			magicStatus = 'error';
			magicError = err instanceof Error ? err.message : String(err);
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
	</div>
	<div class="relative h-150 overflow-hidden rounded-lg border border-(--border)">
		{#if magicStatus !== 'idle'}
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
						<Button
							type="cancel"
							callback={() => {
								magicStatus = 'idle';
								magicError = null;
							}}>{$t('editor.cancel')}</Button
						>
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
