<script lang="ts">
	import { t } from 'svelte-i18n';
	import personIcon from '$lib/assets/icons/user.svg';
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { Profile } from '$lib/features/profile/types';

	let { profile }: { profile: Profile } = $props();

	const fullName = $derived(
		[profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email
	);
	// The M2M has no explicit "primary" ordering -- the first returned role is
	// treated as primary for this header only; the Account & Scope card below
	// lists every held role.
	const primaryRole = $derived(profile.roles[0] ?? null);
</script>

<div
	class="bg-card flex items-center gap-4 rounded-xl border border-(--border) p-6 text-(--card-foreground)"
>
	<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-(--muted)">
		<img src={personIcon} class="h-10 w-10 opacity-50" alt="" />
	</div>

	<div class="flex min-w-0 flex-col gap-1.5">
		<p class="truncate text-xl font-bold">{fullName}</p>
		<div class="flex flex-wrap items-center gap-2">
			{#if primaryRole}
				<Badge>{primaryRole.name}</Badge>
			{:else}
				<span class="text-sm text-(--muted-foreground)">{$t('profile.header.no_role')}</span>
			{/if}
			{#if profile.company}
				<span class="text-sm text-(--muted-foreground)">{profile.company.name}</span>
			{:else}
				<span class="text-sm text-(--muted-foreground)">{$t('profile.header.no_company')}</span>
			{/if}
		</div>
	</div>
</div>
