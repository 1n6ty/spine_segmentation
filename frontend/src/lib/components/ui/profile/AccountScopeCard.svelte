<script lang="ts">
	import { t, locale } from 'svelte-i18n';
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { Profile } from '$lib/features/profile/types';

	let { profile }: { profile: Profile } = $props();

	function formatDateTime(iso: string | null): string | null {
		if (!iso) return null;
		return new Date(iso).toLocaleString($locale ?? undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div
	class="bg-card flex flex-col gap-6 rounded-xl border border-(--border) p-6 text-(--card-foreground)"
>
	<h2 class="text-2xl font-bold">{$t('profile.account_info.title')}</h2>

	<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div>
			<dt class="text-xs text-(--muted-foreground)">{$t('profile.account_info.date_joined')}</dt>
			<dd class="text-sm font-medium">{formatDateTime(profile.date_joined)}</dd>
		</div>
		<div>
			<dt class="text-xs text-(--muted-foreground)">{$t('profile.account_info.last_login')}</dt>
			<dd class="text-sm font-medium">
				{formatDateTime(profile.last_login) ?? $t('profile.account_info.never_logged_in')}
			</dd>
		</div>
	</dl>

	<div>
		<p class="mb-2 text-xs text-(--muted-foreground)">{$t('profile.account_info.roles')}</p>
		{#if profile.roles.length > 0}
			<div class="flex flex-wrap gap-2">
				{#each profile.roles as role (role.slug)}
					<Badge>{role.name}</Badge>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-(--muted-foreground)">{$t('profile.header.no_role')}</p>
		{/if}
	</div>

	<div>
		<p class="mb-2 text-xs text-(--muted-foreground)">
			{$t('profile.account_info.managed_companies')}
		</p>
		{#if profile.managed_companies.length > 0}
			<div class="flex flex-wrap gap-2">
				{#each profile.managed_companies as company (company.slug)}
					<Badge>{company.name}</Badge>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-(--muted-foreground)">{$t('profile.header.no_company')}</p>
		{/if}
	</div>
</div>
