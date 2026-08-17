<script lang="ts">
	import leaveIcon from '$lib/assets/icons/leave.svg';
	import forwardIcon from '$lib/assets/icons/forward.svg';
	import personIcon from '$lib/assets/icons/user.svg';

	import { t } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import { project } from '$lib/core/project.svelte';
	import { post } from '$lib/core/network/client';

	// `project.auth.status` is a shared singleton: the enclosing page/layout
	// (landing page or the (authenticated) guard) is what actually calls
	// `project.auth.verify()` against the backend -- this component only
	// reads the result, so it never shows profile data that hasn't been
	// backend-confirmed.

	async function handleLogout() {
		try {
			await post('/api/logout/');
		} catch {
			// Best-effort: even if the request fails, clear local state and send the
			// user back to login — the client-side guard will re-check on next visit.
		}

		project.auth.reject();
		project.resetSession();

		await goto(`/${page.params.lang}/login`);
	}
</script>

{#if project.auth.status === 'authenticated'}
	<div class="flex min-w-0 items-center gap-4">
		<div
			class="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-(--border) px-4 py-2"
		>
			<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--muted)">
				<img src={personIcon} class="h-6 w-6 opacity-50" alt="user" />
			</div>

			<div class="flex min-w-0 flex-col">
				<p class="truncate text-sm font-medium text-gray-900">
					{project.researcher.fullName ?? $t('not_found')}
				</p>
				<p class="text-xs whitespace-nowrap text-gray-500">
					{project.researcher.duty}
				</p>
			</div>
		</div>

		<button
			onclick={handleLogout}
			class="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-(--border) bg-(--background) px-3 text-sm font-medium whitespace-nowrap text-(--foreground) transition-all outline-none hover:bg-(--accent) hover:text-(--accent-foreground) focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50 disabled:pointer-events-none disabled:opacity-50 has-[>img]:px-2.5 aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 [&_img]:pointer-events-none [&_img]:shrink-0 [&_img:not([class*='size-'])]:size-4"
		>
			<img src={leaveIcon} class="h-4 w-4" alt="leave" />
			<span class="block">
				{$t('header.logout')}
			</span>
		</button>
	</div>
{:else}
	<div class="flex min-w-0 items-center gap-4">
		<div
			class="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-(--border) px-4 py-2"
		>
			<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--muted)">
				<img src={personIcon} class="h-6 w-6 opacity-30" alt="" />
			</div>
			<p class="truncate text-sm font-medium text-gray-500">
				{$t('header.not_logged_in')}
			</p>
		</div>

		<a
			href={`/${page.params.lang}/login`}
			class="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-(--border) bg-(--background) px-3 text-sm font-medium whitespace-nowrap text-(--foreground) transition-all outline-none hover:bg-(--accent) hover:text-(--accent-foreground) focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50 [&_img]:pointer-events-none [&_img]:shrink-0 [&_img:not([class*='size-'])]:size-4"
		>
			<img src={forwardIcon} class="h-4 w-4" alt="" />
			<span class="block">
				{$t('header.login')}
			</span>
		</a>
	</div>
{/if}
