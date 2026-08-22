<script lang="ts">
	import { t } from 'svelte-i18n';
	import type { Projection } from '$lib/features/dicom/types';
	import { project } from '$lib/core/project.svelte';
	import { SegmentRangePicker } from '$lib/features/medical-parameters/segment-range-picker.svelte';
	import { add_segment } from '$lib/features/medical-parameters/segments';
	import { expand_vertebra_id_range } from '$lib/shared/anatomy/segment-range';
	import Button from '$lib/components/ui/button/Button.svelte';
	import SegmentRangeCanvas from './SegmentRangeCanvas.svelte';

	let { projection, onClose }: { projection: Projection; onClose: () => void } = $props();

	const picker = new SegmentRangePicker(() => project.session.projections[projection].polygons);

	function handleCreate() {
		const range = picker.range;
		if (!range) return;
		// Defensive only -- structurally unreachable given the picker's own clamping/min-max
		// logic over an already spine-ordered polygons array (see the plan's validation
		// section), kept as cheap insurance against a corrupted/unrecognized vertebra id.
		if (!expand_vertebra_id_range(range.topId, range.bottomId)) return;
		add_segment(projection, range.topId, range.bottomId);
		onClose();
	}

	// Window-scoped (not scoped to a card, unlike EditorCanvas.svelte's per-card shortcuts) --
	// this is a single full-viewport modal, so Escape should close it regardless of where
	// focus happens to be inside it.
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-(--background)/50 backdrop-blur-sm"
>
	<div
		class="relative flex h-[85vh] w-[90vw] max-w-4xl flex-col gap-4 rounded-xl border border-(--border) bg-(--card) p-6 text-(--card-foreground) shadow-lg"
	>
		<div class="absolute top-3 right-3">
			<Button type="cancel" callback={onClose} shortcut="Esc" />
		</div>
		<div class="pr-8">
			<h2 class="text-lg font-semibold">{$t('segments.modal_title')}</h2>
			<p class="text-sm text-(--muted-foreground)">{$t('segments.select_range_instructions')}</p>
		</div>
		<div class="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-(--border)">
			<SegmentRangeCanvas {picker} />
		</div>
		<div class="flex justify-end">
			<Button type="add" callback={handleCreate} disabled={!picker.hasSelection}>
				{$t('segments.create')}
			</Button>
		</div>
	</div>
</div>
