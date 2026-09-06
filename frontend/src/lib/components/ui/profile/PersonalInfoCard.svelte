<script lang="ts">
	import { t } from 'svelte-i18n';
	import { project } from '$lib/core/project.svelte';
	import { updateProfile, ProfilePatchError } from '$lib/features/profile/api';
	import { validatePersonalInfo, type ValidationErrors } from '$lib/features/profile/validation';
	import type { Profile } from '$lib/features/profile/types';

	let { profile, onsave }: { profile: Profile; onsave: (updated: Profile) => void } = $props();

	// Deliberately seeded once, not kept in sync with `profile` -- these are
	// local edit-buffer state; onsave() below already replaces `profile` with
	// the server's response on a successful save, so re-deriving from the prop
	// here would either fight the user's in-progress edits or be redundant.
	// svelte-ignore state_referenced_locally
	let first_name = $state(profile.first_name);
	// svelte-ignore state_referenced_locally
	let last_name = $state(profile.last_name);
	// svelte-ignore state_referenced_locally
	let patronymic = $state(profile.patronymic);
	// svelte-ignore state_referenced_locally
	let email = $state(profile.email);
	// svelte-ignore state_referenced_locally
	let phone = $state(profile.phone ?? '');

	let submitting = $state(false);
	let successMessage = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let fieldErrors = $state<ValidationErrors>({});

	const INPUT_CLASS =
		'flex h-9 w-full min-w-0 rounded-md border border-(--border) bg-(--input-background) px-3 py-1 text-base transition-[color,box-shadow] outline-none selection:bg-(--primary) selection:text-(--primary-foreground) placeholder:text-(--muted-foreground) focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 md:text-sm';

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		successMessage = null;
		errorMessage = null;

		const validation = validatePersonalInfo({ first_name, last_name });
		if (Object.keys(validation).length > 0) {
			fieldErrors = validation;
			return;
		}
		fieldErrors = {};

		submitting = true;
		try {
			const updated = await updateProfile(profile.id, {
				first_name,
				last_name,
				patronymic,
				email,
				phone
			});
			successMessage = $t('profile.personal_info.success') as string;
			// Keep the header's cached identity (ProfileBar reads project.researcher,
			// not this page's local `profile` state) from showing a stale name/email
			// until the next full verify() -- e.g. after editing your own email here.
			project.researcher.email = updated.email;
			project.researcher.fullName =
				[updated.first_name, updated.last_name].filter(Boolean).join(' ') || updated.email;
			onsave(updated);
		} catch (err) {
			if (err instanceof ProfilePatchError) {
				const byField: ValidationErrors = {};
				for (const issue of err.fieldErrors) {
					if (
						issue.field === 'first_name' ||
						issue.field === 'last_name' ||
						issue.field === 'email'
					) {
						byField[issue.field] = issue.message;
					}
				}
				fieldErrors = byField;
				errorMessage = err.message || ($t('profile.personal_info.error') as string);
			} else {
				errorMessage = $t('profile.personal_info.error') as string;
			}
		} finally {
			submitting = false;
		}
	}
</script>

<div
	class="bg-card flex flex-col gap-6 rounded-xl border border-(--border) p-6 text-(--card-foreground)"
>
	<h2 class="text-2xl font-bold">{$t('profile.personal_info.title')}</h2>

	<form class="flex flex-col gap-4" onsubmit={handleSubmit}>
		{#if successMessage}
			<div class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
				<p class="text-sm font-medium text-green-800">{successMessage}</p>
			</div>
		{/if}
		{#if errorMessage}
			<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
				{errorMessage}
			</div>
		{/if}

		<div>
			<label class="text-sm leading-none font-medium" for="profile-first-name">
				{$t('profile.personal_info.first_name')}
			</label>
			<input id="profile-first-name" bind:value={first_name} class={INPUT_CLASS} />
			{#if fieldErrors.first_name}
				<p class="mt-1 text-xs text-red-700">
					{$t('profile.personal_info.validation.first_name_required')}
				</p>
			{/if}
		</div>

		<div>
			<label class="text-sm leading-none font-medium" for="profile-last-name">
				{$t('profile.personal_info.last_name')}
			</label>
			<input id="profile-last-name" bind:value={last_name} class={INPUT_CLASS} />
			{#if fieldErrors.last_name}
				<p class="mt-1 text-xs text-red-700">
					{$t('profile.personal_info.validation.last_name_required')}
				</p>
			{/if}
		</div>

		<div>
			<label class="text-sm leading-none font-medium" for="profile-patronymic">
				{$t('profile.personal_info.patronymic')}
			</label>
			<input id="profile-patronymic" bind:value={patronymic} class={INPUT_CLASS} />
		</div>

		<div>
			<label class="text-sm leading-none font-medium" for="profile-email">
				{$t('profile.personal_info.email')}
			</label>
			<input
				id="profile-email"
				type="email"
				autocomplete="email"
				bind:value={email}
				class={INPUT_CLASS}
			/>
			{#if fieldErrors.email}
				<p class="mt-1 text-xs text-red-700">{fieldErrors.email}</p>
			{/if}
		</div>

		<div>
			<label class="text-sm leading-none font-medium" for="profile-phone">
				{$t('profile.personal_info.phone')}
			</label>
			<input id="profile-phone" type="tel" bind:value={phone} class={INPUT_CLASS} />
		</div>

		<button
			type="submit"
			disabled={submitting}
			class="inline-flex h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-(--primary) px-4 py-2 text-sm font-medium whitespace-nowrap text-(--primary-foreground) transition-all outline-none hover:bg-(--primary)/90 disabled:pointer-events-none disabled:opacity-50"
		>
			{submitting ? $t('profile.personal_info.saving') : $t('profile.personal_info.save')}
		</button>
	</form>
</div>
