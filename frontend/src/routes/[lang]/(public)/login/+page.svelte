<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import favicon from '$lib/assets/icons/favicon.svg';
	import { post } from '$lib/core/network/client';
	import { project } from '$lib/core/project.svelte';

	let email = $state('');
	let password = $state('');
	let rememberMe = $state(false);
	let submitting = $state(false);
	let error = $state<string | null>(null);

	/**
	 * The mirror image of (authenticated)/+layout.svelte's guard: a request
	 * can only ever prove "I already have a live session" by asking the
	 * backend (the sessionid cookie is HttpOnly -- SESSION_COOKIE_HTTPONLY=True
	 * server-side -- so it's invisible to document.cookie; the browser still
	 * attaches it automatically to this call regardless). Gating the form on
	 * `checked` avoids flashing the login form before the redirect fires, same
	 * discipline as the authenticated layout.
	 */
	let checked = $state(false);

	onMount(async () => {
		const ok = await project.auth.verify();
		checked = true;
		if (ok) {
			await goto(`/${page.params.lang}/`);
		}
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		submitting = true;

		try {
			const res = await post('/api/login/', {
				json: { email, password, remember_me: rememberMe }
			});

			if (!res.ok) {
				error = $t('login.error');
				return;
			}

			// The login response itself carries no identity, just confirmation that
			// the session cookie was set — fetch the real identity from /api/me/ so
			// researcher info and the per-account local session cache are populated
			// from a backend-verified source, not the login form input.
			await project.auth.verify();

			await goto(`/${page.params.lang}/`);
		} catch {
			error = $t('login.error');
		} finally {
			submitting = false;
		}
	}
</script>

{#if checked && project.auth.status !== 'authenticated'}
	<div
		class="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100"
	>
		<div class="w-full max-w-md">
			<div class="mb-8 text-center">
				<div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-white">
					<img src={favicon} alt="favicon" class="h-8 w-8" />
				</div>
				<h1 class="mb-2 text-3xl text-gray-900">Spine Segmentation</h1>
				<p class="text-gray-600">{$t('header.p')}</p>
			</div>
			<div class="rounded-lg bg-white p-8 shadow-xl">
				<form class="space-y-4" onsubmit={handleSubmit}>
					{#if error}
						<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
							{error}
						</div>
					{/if}
					<div>
						<label
							class="flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
							for="login-email"
						>
							{$t('login.email')}
						</label>
						<input
							type="email"
							id="login-email"
							autocomplete="email"
							bind:value={email}
							class="flex h-9 w-full min-w-0 rounded-md border border-(--border) bg-(--input-background) px-3 py-1 text-base transition-[color,box-shadow] outline-none selection:bg-(--primary) selection:text-(--primary-foreground) file:inline-flex file:h-7 file:border-0 file:bg-(--transparent) file:text-sm file:font-medium file:text-(--foreground) placeholder:text-(--muted-foreground) focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 md:text-sm dark:bg-(--input)/30 dark:aria-invalid:ring-(--destructive)/40"
							placeholder="doctor@example.com"
							required
						/>
					</div>
					<div>
						<label
							class="flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
							for="login-password"
						>
							{$t('login.password')}
						</label>
						<input
							type="password"
							id="login-password"
							autocomplete="current-password"
							bind:value={password}
							class="flex h-9 w-full min-w-0 rounded-md border border-(--border) bg-(--input-background) px-3 py-1 text-base transition-[color,box-shadow] outline-none selection:bg-(--primary) selection:text-(--primary-foreground) file:inline-flex file:h-7 file:border-0 file:bg-(--transparent) file:text-sm file:font-medium file:text-(--foreground) placeholder:text-(--muted-foreground) focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 md:text-sm dark:bg-(--input)/30 dark:aria-invalid:ring-(--destructive)/40"
							placeholder="••••••••"
							required
						/>
					</div>
					<label
						class="flex cursor-pointer items-center gap-2 text-sm text-(--muted-foreground) select-none"
					>
						<input type="checkbox" bind:checked={rememberMe} class="cursor-pointer" />
						{$t('login.remember_me')}
					</label>
					<button
						type="submit"
						disabled={submitting}
						class="inline-flex h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-(--primary) px-4 py-2 text-sm font-medium whitespace-nowrap text-(--primary-foreground) transition-all outline-none hover:bg-(--primary)/90 focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50 disabled:pointer-events-none disabled:opacity-50 has-[>img]:px-3 aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 [&_img]:pointer-events-none [&_img]:shrink-0 [&_img:not([class*='size-'])]:size-4"
					>
						{submitting ? $t('login.submitting') : $t('login.submit')}
					</button>
				</form>
			</div>
		</div>
	</div>
{/if}
