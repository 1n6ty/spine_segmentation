<script lang="ts">
	import { params } from '$lib/features/medical-parameters/parameters-store.svelte';
	import OverallSpine from './OverallSpine.svelte';
	import Table from './Table.svelte';
</script>

{#if params.activeStructure == 'overall'}
	<OverallSpine />
{:else}
	<Table projection="side" />
	<Table projection="frontal" />
{/if}
