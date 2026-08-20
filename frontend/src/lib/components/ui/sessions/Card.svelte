<script lang="ts">
	import { t, locale } from 'svelte-i18n';

	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import userSVG from '$lib/assets/icons/user.svg';
	import timerSVG from '$lib/assets/icons/timer.svg';
	import calendarSVG from '$lib/assets/icons/calendar.svg';
	import deleteSVG from '$lib/assets/icons/delete.svg';
	import { project } from '$lib/core/project.svelte';
	import { research_url } from '$lib/shared/utils/routing';

	let { active = false, sessionUID }: { active: boolean; sessionUID: string } = $props();

	const session = $derived(project.registry.sessionValues[sessionUID]);

	// Thumbnail arrives from the backend as a data URI already -- no
	// Blob/createObjectURL lifecycle to manage anymore. Falls back to a
	// purely-local, never-uploaded preview (registry.localThumbnails,
	// set right after a client-side upload) only until the server's own
	// generated thumbnail shows up here.
	const thumbUrl = $derived(
		session?.thumbnail ?? project.registry.localThumbnails[sessionUID] ?? null
	);

	const dateTimeOptions = {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	} as const;

	let now = $state(Date.now());
	$effect(() => {
		if (active) return;

		const interval = setInterval(() => (now = Date.now()), 60000);
		return () => clearInterval(interval);
	});

	const timeAgo = $derived.by(() => {
		if (!session) return;

		const diff = (session.lastAccessed - now) / 1000;

		if (Math.abs(diff) < 60) return $t('units.time.now');
		if (Math.abs(diff) < 3600)
			return `${Math.floor(Math.abs(diff) / 60)}${$t('units.time.m')} ${$t('units.time.ago')}`;
		if (Math.abs(diff) < 86400)
			return `${Math.floor(Math.abs(diff) / 3600)}${$t('units.time.h')} ${$t('units.time.ago')}`;
		return `${Math.floor(Math.abs(diff) / 86400)}${$t('units.time.d')} ${$t('units.time.ago')}`;
	});

	function makeActive() {
		project.resetSession(sessionUID);
		// Always navigate -- switching research now always tracks into the
		// URL/browser history (/researches/{id}/...), not just when starting
		// from the bare landing page. Preserves whichever tab is currently
		// open (defaults to 'patient' when there isn't one, e.g. coming from
		// the landing page itself).
		goto(research_url(page.params.lang!, sessionUID, page.url.pathname));
	}

	async function handleDelete(e: MouseEvent) {
		e.stopPropagation();

		// 1. Clear project global if it's the one we are deleting
		if (active) {
			project.resetSession();
		}

		// 2. Perform the registry delete
		await project.registry.delete(sessionUID);
	}
</script>

{#if session}
	{#if active}
		<div
			class="flex cursor-pointer flex-col gap-6 rounded-xl border-2 border-(--primary) bg-(--primary)/5 p-2 text-(--card-foreground) transition-all hover:border-(--primary) hover:shadow-md"
		>
			<div class="flex gap-2">
				<div class="relative h-26.5 w-16 shrink-0 overflow-hidden rounded bg-gray-900">
					<img class="mx-auto block h-full object-cover" src={thumbUrl} alt="Preview" />
				</div>
				<div class="flex min-w-0 flex-1 flex-col justify-between">
					<div class="flex items-center justify-between gap-1">
						<div class="flex min-w-0 flex-1 items-center gap-1">
							<img src={userSVG} alt="Patient" class="h-3 w-3" />
							<p class="truncate text-xs font-semibold">
								{session.brief.patientName ?? $t('not_found')}
							</p>
						</div>
						<button
							onclick={(e) => {
								e.stopPropagation();
								handleDelete(e);
							}}
							class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md p-0 text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-(--accent) hover:text-(--accent-foreground) focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50 disabled:pointer-events-none disabled:opacity-50 has-[>img]:px-1.5 aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 [&_img]:pointer-events-none [&_img]:shrink-0"
						>
							<img
								src={deleteSVG}
								alt="Delete"
								class="h-4 w-4"
								style="filter: invert(26%) sepia(85%) saturate(2227%) hue-rotate(331deg) brightness(90%) contrast(105%);"
							/>
						</button>
					</div>
					<div class="truncate font-mono text-[10px] text-(--muted-foreground)">
						ID: {session.brief.patientUID ?? $t('not_found')}
					</div>
					<div class="flex items-center text-[9px]">
						<span class="flex items-center gap-0.5 text-(--muted-foreground)"
							>{session.sidePresent ? 'LATERAL' : ''} / {session.frontalPresent
								? 'FRONTAL'
								: ''}</span
						>
					</div>
					<div class="flex items-center gap-1 text-[10px] text-(--muted-foreground)">
						<img src={calendarSVG} alt="Birthday" class="h-2.5 w-2.5" />
						<span
							>{session.brief.patientBirthdate?.toLocaleDateString(
								$locale ?? undefined,
								dateTimeOptions
							) ?? $t('not_found')}</span
						>
					</div>
					<div class="mt-1 border-t">
						<span
							class="border-(transparent) inline-flex h-4 w-full shrink-0 items-center justify-center rounded-md border bg-(--primary) px-1.5 py-0 text-[9px] font-medium whitespace-nowrap text-(--primary-foreground)"
						>
							● {$t('research.active')}
						</span>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div
			onclick={makeActive}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					makeActive();
				}
			}}
			role="button"
			tabindex="0"
			class="flex cursor-pointer flex-col gap-6 rounded-xl border border-(--border) bg-(--card) p-2 text-(--card-foreground) transition-all hover:border-(--primary) hover:shadow-md"
		>
			<div class="flex gap-2">
				<div class="relative h-26.5 w-16 shrink-0 overflow-hidden rounded bg-gray-900">
					<img class="mx-auto block h-full object-cover" src={thumbUrl} alt="Preview" />
				</div>
				<div class="flex min-w-0 flex-1 flex-col justify-between">
					<div class="flex items-center justify-between gap-1">
						<div class="flex min-w-0 flex-1 items-center gap-1">
							<img src={userSVG} alt="Patient" class="h-3 w-3" />
							<p class="truncate text-xs font-semibold">
								{session.brief.patientName ?? $t('not_found')}
							</p>
						</div>
						<button
							onclick={(e) => {
								e.stopPropagation();
								handleDelete(e);
							}}
							class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md p-0 text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-(--accent) hover:text-(--accent-foreground) focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50 disabled:pointer-events-none disabled:opacity-50 has-[>img]:px-1.5 aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 [&_img]:pointer-events-none [&_img]:shrink-0"
						>
							<img
								src={deleteSVG}
								alt="Delete"
								class="h-4 w-4"
								style="filter: invert(26%) sepia(85%) saturate(2227%) hue-rotate(331deg) brightness(90%) contrast(105%);"
							/>
						</button>
					</div>
					<div class="truncate font-mono text-[10px] text-(--muted-foreground)">
						ID: {session.brief.patientUID ?? $t('not_found')}
					</div>
					<div class="flex items-center text-[9px]">
						<span class="flex items-center gap-0.5 text-(--muted-foreground)"
							>{session.sidePresent ? 'LATERAL' : ''} / {session.frontalPresent
								? 'FRONTAL'
								: ''}</span
						>
					</div>
					<div class="flex items-center gap-1 text-[10px] text-(--muted-foreground)">
						<img src={calendarSVG} alt="Birthday" class="h-2.5 w-2.5" />
						<span
							>{session.brief.patientBirthdate?.toLocaleDateString(
								$locale ?? undefined,
								dateTimeOptions
							) ?? $t('not_found')}</span
						>
					</div>
					<div class="mt-1 flex items-center justify-between border-t pt-1">
						<span class="flex items-center gap-0.5 text-[10px] text-(--muted-foreground)">
							<img src={timerSVG} alt="Last time accessed" class="h-2.5 w-2.5" />
							{timeAgo}
						</span>
					</div>
				</div>
			</div>
		</div>
	{/if}
{/if}
