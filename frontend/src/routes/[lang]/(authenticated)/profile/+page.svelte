<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from 'svelte-i18n';
	import { fetchProfile } from '$lib/features/profile/api';
	import type { Profile } from '$lib/features/profile/types';
	import ProfileHeaderCard from '$lib/components/ui/profile/ProfileHeaderCard.svelte';
	import PersonalInfoCard from '$lib/components/ui/profile/PersonalInfoCard.svelte';
	import AccountScopeCard from '$lib/components/ui/profile/AccountScopeCard.svelte';

	let profile = $state<Profile | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	onMount(async () => {
		try {
			profile = await fetchProfile();
		} catch {
			loadError = $t('profile.load_error') as string;
		} finally {
			loading = false;
		}
	});

	function handleSave(updated: Profile) {
		profile = updated;
	}
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-6">
	<h1 class="text-3xl font-bold">{$t('profile.title')}</h1>

	{#if loading}
		<p class="text-sm text-(--muted-foreground)">{$t('profile.loading')}</p>
	{:else if loadError}
		<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
			{loadError}
		</div>
	{:else if profile}
		<ProfileHeaderCard {profile} />
		<PersonalInfoCard {profile} onsave={handleSave} />
		<AccountScopeCard {profile} />
	{/if}
</div>
