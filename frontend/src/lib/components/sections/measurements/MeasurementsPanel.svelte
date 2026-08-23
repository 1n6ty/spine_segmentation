<script lang="ts">
	import { untrack } from 'svelte';
	import { params, structures } from '$lib/features/medical-parameters/parameters-store.svelte';
	import { sync_generated_segments } from '$lib/features/medical-parameters/generated-segments';
	import type { Projection } from '$lib/features/dicom/types';
	import OverallSpine from './OverallSpine.svelte';
	import Table from './Table.svelte';
	import SegmentRangeModal from './SegmentRangeModal.svelte';

	let modalProjection = $state<Projection | null>(null);

	// Keeps each projection's auto-detected arc segments (see central-arc-segments.ts) fresh
	// and persisted whenever its polygons change, while this tab is mounted. `sync_generated_segments`
	// itself reads/writes `segments`, not just `polygons` -- calling it inside `untrack` keeps this
	// effect's dependency limited to `vertebrae` (polygons), so its own write to `segments` (e.g.
	// dropping a deleted generated row) doesn't re-trigger itself and undo the deletion.
	$effect(() => {
		structures.side.vertebrae;
		untrack(() => sync_generated_segments('side'));
	});
	$effect(() => {
		structures.frontal.vertebrae;
		untrack(() => sync_generated_segments('frontal'));
	});
</script>

{#if params.activeStructure == 'overall'}
	<OverallSpine />
{:else}
	<Table projection="side" onAddSegment={(p) => (modalProjection = p)} />
	<Table projection="frontal" onAddSegment={(p) => (modalProjection = p)} />
{/if}

{#if modalProjection}
	<SegmentRangeModal projection={modalProjection} onClose={() => (modalProjection = null)} />
{/if}
