<script lang="ts">
	import { params } from '$lib/features/medical-parameters/parameters-store.svelte';
	import type { Projection } from '$lib/features/dicom/types';
	import OverallSpine from './OverallSpine.svelte';
	import Table from './Table.svelte';
	import SegmentRangeModal from './SegmentRangeModal.svelte';

	let modalProjection = $state<Projection | null>(null);
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
