<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from 'svelte-i18n';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { fetchProfile } from '$lib/features/profile/api';
	import type { Profile } from '$lib/features/profile/types';
	import ProfileHeaderCard from '$lib/components/ui/profile/ProfileHeaderCard.svelte';
	import PersonalInfoCard from '$lib/components/ui/profile/PersonalInfoCard.svelte';
	import AccountScopeCard from '$lib/components/ui/profile/AccountScopeCard.svelte';
	import BackIcon from '$lib/assets/icons/left.svg';

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

	function goBack() {
		// ProfileBar/logo can link here from anywhere authenticated -- browser
		// history is the only thing that knows where "back" actually is. Falls
		// back to the app root only when there's no prior entry to return to
		// (e.g. /profile opened directly, as its own tab/bookmark).
		if (window.history.length > 1) {
			window.history.back();
		} else {
			goto(`/${page.params.lang}`);
		}
	}
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-6">
	<div class="flex items-center gap-3">
		<button
			type="button"
			onclick={goBack}
			aria-label={$t('icons_alt.back')}
			title={$t('icons_alt.back')}
			class="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-(--border) bg-(--background) text-(--foreground) transition-all outline-none hover:bg-(--accent) hover:text-(--accent-foreground) focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50"
		>
			<img src={BackIcon} alt="" class="size-4" />
		</button>
		<h1 class="text-3xl font-bold">{$t('profile.title')}</h1>
	</div>

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
