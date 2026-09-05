<script lang="ts">
	// Placeholder for a recent-research row that hasn't been fetched yet (first
	// page load, or the carousel scrolled past the loaded set before the next
	// page arrived). Mirrors Card.svelte's non-active layout box.
</script>

<div
	class="flex animate-pulse flex-col gap-6 rounded-xl border border-(--border) bg-(--card) p-2"
	aria-hidden="true"
>
	<div class="flex gap-2">
		<div class="h-26.5 w-16 shrink-0 rounded bg-(--muted)"></div>
		<div class="flex min-w-0 flex-1 flex-col justify-between gap-2 py-1">
			<div class="h-3 w-3/4 rounded bg-(--muted)"></div>
			<div class="h-2.5 w-1/2 rounded bg-(--muted)"></div>
			<div class="h-2.5 w-2/3 rounded bg-(--muted)"></div>
			<div class="h-2.5 w-1/3 rounded bg-(--muted)"></div>
			<div class="mt-1 h-4 w-full rounded bg-(--muted)"></div>
		</div>
	</div>
</div>
