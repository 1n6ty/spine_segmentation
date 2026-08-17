<script lang="ts">
	import { page } from '$app/state';
	import type { supportedLocales } from '$lib/core/i18n/index.svelte';
	import { locale } from 'svelte-i18n';
	import { project } from '$lib/core/project.svelte';

	const menu: Record<(typeof supportedLocales)[number], string[]> = {
		'en-US': ['Patient Info', 'X-Ray Editing', 'Measurements', 'Diagnostic report'],
		'ru-RU': ['Информация о пациенте', 'X-Ray Редактирование', 'Измерения', 'Диагностический отчёт']
	} as const;

	// Research-scoped once there's an active session (tracks into
	// /researches/{id}/...), falling back to the bare, id-less tabs when
	// there isn't one yet (e.g. before any research has been created).
	const base = $derived(
		project.session.sessionUID
			? `/${page.params.lang}/researches/${project.session.sessionUID}`
			: `/${page.params.lang}`
	);

	const links = $derived([
		`${base}/patient`,
		`${base}/edit`,
		`${base}/measure`,
		`${base}/report`
	]);

	let activeIndex = $derived(links.findIndex((link) => page.url.pathname.includes(link)));
</script>

<nav
	class="main-nav grid h-9 w-full grid-cols-4 items-center justify-center rounded-xl bg-(--muted) p-0.75 text-(--muted-foreground)"
>
	{#each menu[$locale as (typeof supportedLocales)[number]] as choice, i}
		<a
			href={links[i]}
			onclick={(e) => {
				activeIndex = i;
			}}
			data-state={i == activeIndex ? 'active' : 'unactive'}
			class="
                main-nav inline-flex h-[calc(100%-1px)]
                flex-1
                cursor-pointer
                items-center
                justify-center
                gap-1.5
                truncate
                rounded-xl
                border
                border-transparent px-2
                py-1 text-sm
                font-medium whitespace-nowrap text-(--foreground)
                transition-[color,box-shadow] focus-visible:border-(--ring)
                focus-visible:ring-[3px] focus-visible:ring-(--ring)/50 focus-visible:outline-1 focus-visible:outline-(--ring)
                disabled:pointer-events-none disabled:opacity-50
                data-[state=active]:bg-(--card) dark:text-(--muted-foreground)
                dark:data-[state=active]:border-(--input) dark:data-[state=active]:text-(--foreground)
                [&_svg]:pointer-events-none [&_svg]:shrink-0
                [&_svg:not([class*='size-'])]:size-4
            "
		>
			<span class="truncate">{choice}</span>
		</a>
	{/each}
</nav>

<style>
	.main-nav {
		outline: none;
	}
</style>
