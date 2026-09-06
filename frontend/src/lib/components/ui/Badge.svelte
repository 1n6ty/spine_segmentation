<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<span
	class="inline-flex items-center rounded-full border border-(--border) bg-(--muted) px-2.5 py-0.5 text-xs font-medium text-(--muted-foreground)"
>
	{@render children()}
</span>
