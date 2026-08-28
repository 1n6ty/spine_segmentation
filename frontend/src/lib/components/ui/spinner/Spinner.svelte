<script lang="ts">
	// Shared indeterminate spinner. i18n-free -- callers pass an already-resolved
	// `label` string (see LoadingOverlay / SessionLoadingGate). `animate-spin`
	// ships with Tailwind v4 with no config; colour follows `currentColor`.
	let { size = 'md', label }: { size?: 'sm' | 'md' | 'lg'; label?: string } = $props();

	const sizeClass = { sm: 'size-4', md: 'size-8', lg: 'size-12' } as const;
</script>

<div class="flex flex-col items-center gap-3 text-(--primary)">
	<svg
		class="animate-spin {sizeClass[size]}"
		viewBox="0 0 24 24"
		fill="none"
		role="status"
		aria-label={label ?? 'Loading'}
	>
		<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.2" />
		<path
			d="M12 2a10 10 0 0 1 10 10"
			stroke="currentColor"
			stroke-width="3"
			stroke-linecap="round"
		/>
	</svg>
	{#if label}
		<span class="text-sm font-medium text-(--foreground)">{label}</span>
	{/if}
</div>
