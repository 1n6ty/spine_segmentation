<script lang="ts">
	import timerSVG from '$lib/assets/icons/timer.svg';
	import plusSVG from '$lib/assets/icons/add.svg';
	import deleteSVG from '$lib/assets/icons/delete.svg';
	import leftSVG from '$lib/assets/icons/left.svg';
	import rightSVG from '$lib/assets/icons/right.svg';
	import Card from './Card.svelte';
	import { project } from '$lib/core/project.svelte';
	import type { SessionValue } from '$lib/core/session/types';
	import { t } from 'svelte-i18n';

	let sessions = $state<SessionValue[]>([]);
	$effect(() => {
		sessions = Object.values(project.registry.sessionValues).sort(
			(a, b) => b.lastAccessed - a.lastAccessed
		);
	});

	let currentIndex = $state(0);
	const cardWidth = 260;
	const gap = 16;

	let containerWidth = $state(0);
	let visibleCount = $derived(containerWidth > 0 ? containerWidth / (cardWidth + gap) : 1);
	const translateX = $derived(-(currentIndex * (cardWidth + gap)));

	function next() {
		// Prevent scrolling past the end
		if (currentIndex < sessions.length - visibleCount) {
			currentIndex++;
		}
	}

	function prev() {
		if (currentIndex > 0) {
			currentIndex--;
		}
	}

	function handleCreate(e: MouseEvent) {
		e.preventDefault();

		project.resetSession();
	}

	function handleDeleteAll(e: MouseEvent) {
		e.preventDefault();

		project.resetSession();
		project.registry.clearAll();
	}

	// Keeps a Tab-focused card in view even though it may sit outside the
	// currently-slid-to window -- without this, tabbing past the last visible
	// card leaves focus on an offscreen element with no visual indication.
	function handleFocusIn(e: FocusEvent) {
		const cardEl = (e.target as HTMLElement).closest('[data-card-index]');
		if (!cardEl) return;

		const i = Number(cardEl.getAttribute('data-card-index'));
		if (Number.isNaN(i)) return;

		const maxIndex = Math.max(0, sessions.length - visibleCount);
		if (i < currentIndex) {
			currentIndex = Math.min(i, maxIndex);
		} else if (i > currentIndex + visibleCount - 1) {
			currentIndex = Math.min(i - visibleCount + 1, maxIndex);
		}
	}

	function handleTrackKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			prev();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			next();
		}
	}
</script>

<div
	class="relative mb-4 flex flex-col gap-6 rounded-xl border border-(--border) bg-(--background) p-4 text-(--card-foreground)"
>
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<img src={timerSVG} alt="timer" class="h-5 w-5" />
			<h3 class="text-lg font-semibold">
				{$t('research.head')}
			</h3>
			<span
				class="inline-flex h-5 w-fit shrink-0 items-center justify-center overflow-hidden rounded-md border border-transparent bg-(--secondary) px-2 py-0.5 text-sm font-medium whitespace-nowrap text-(--secondary-foreground) transition-[color,box-shadow] focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50 aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 [a&]:hover:bg-(--secondary)/90"
			>
				{sessions.length}
			</span>
		</div>
		<div class="flex gap-2">
			<button
				disabled={!Boolean(project.session.sessionUID)}
				onclick={handleCreate}
				class="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md bg-(--primary) px-3 text-sm font-medium whitespace-nowrap text-(--primary-foreground) transition-all outline-none hover:bg-(--primary)/90 focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50 disabled:pointer-events-none disabled:opacity-50 has-[>img]:px-2.5 aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 [&_img]:pointer-events-none [&_img]:shrink-0 [&_img:not([class*='size-'])]:size-4"
			>
				<img
					src={plusSVG}
					alt="new session"
					class="h-4 w-4"
					style="filter: invert(100%) brightness(200%);"
				/>
				<p class="hidden sm:inline">{$t('research.create_new')}</p>
			</button>
			<button
				onclick={handleDeleteAll}
				class="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md bg-(--destructive) px-3 text-sm font-medium whitespace-nowrap text-white transition-all outline-none hover:bg-(--destructive)/90 focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--destructive)/20 disabled:pointer-events-none disabled:opacity-50 has-[>img]:px-2.5 aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 [&_img]:pointer-events-none [&_img:not([class*='size-'])]:size-4 [&_svg]:shrink-0"
			>
				<img
					src={deleteSVG}
					class="h-4 w-4"
					style="filter: invert(100%) brightness(200%);"
					alt="Clear all sessions"
				/>
				<p class="hidden sm:inline">{$t('research.delete_all')}</p>
			</button>
		</div>
	</div>
	{#if sessions.length > 0}
		<div
			class="relative px-2"
			role="region"
			aria-roledescription="carousel"
			aria-label={$t('research.head')}
		>
			<div class="flex items-center gap-2">
				<button
					onclick={prev}
					disabled={currentIndex === 0}
					class="z-10 inline-flex h-34 cursor-pointer items-center justify-center rounded-md border border-(--border) bg-(--background) px-2 hover:bg-(--accent) disabled:opacity-30"
				>
					<img src={leftSVG} alt="back" class="size-4" />
				</button>

				<!--
					The keydown/focusin handlers here only react to focus/key events bubbling up
					from the focusable Card children below (arrow-key paging, and scrolling a
					Tab-focused card into view) -- this element itself is never a keyboard target.
				-->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div
					class="relative flex h-34 flex-1 items-center overflow-hidden p-2"
					role="group"
					bind:clientWidth={containerWidth}
					onfocusin={handleFocusIn}
					onkeydown={handleTrackKeydown}
				>
					<div
						class="flex flex-row gap-4 transition-transform duration-500 ease-out"
						style="transform: translateX({translateX}px);"
						aria-live="polite"
					>
						{#each sessions as sessionValue, i}
							<div style="width: {cardWidth}px;" class="h-full shrink-0" data-card-index={i}>
								<Card
									active={project.session?.sessionUID === sessionValue.sessionUID}
									sessionUID={sessionValue.sessionUID}
								/>
							</div>
						{/each}
					</div>
				</div>

				<button
					onclick={next}
					disabled={currentIndex >= sessions.length - visibleCount}
					class="z-10 inline-flex h-34 cursor-pointer items-center justify-center rounded-md border border-(--border) bg-(--background) px-2 hover:bg-(--accent) disabled:opacity-30"
				>
					<img src={rightSVG} alt="forward" class="size-4" />
				</button>
			</div>
		</div>
	{/if}
</div>
