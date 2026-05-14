<script lang="ts">
    import { page } from '$app/state';
	import type { supportedLocales } from '$lib/core/i18n/index.svelte';
    import { locale } from "svelte-i18n";

    const menu: Record<typeof supportedLocales[number], string[]> = {
        "en-US": [
            "Patient Info",
            "X-Ray Editing",
            "Measurements",
            "Diagnostic report"
        ],
        "ru-RU": [
            "Информация о пациенте",
            "X-Ray Редактирование",
            "Измерения",
            "Диагностический отчёт"
        ]
    } as const;

	const links = $derived([
		`/${$locale}/patient`,
		`/${$locale}/edit`,
		`/${$locale}/measure`,
		`/${$locale}/report`
	]);

	let activeIndex = $derived(
		links.findIndex(link =>
			page.url.pathname.includes(link)
		)
	);
</script>

<nav class="main-nav bg-(--muted) text-(--muted-foreground) h-9 items-center justify-center rounded-xl p-0.75 grid w-full grid-cols-4">
    {#each menu[$locale as typeof supportedLocales[number]] as choice, i}
        <a
            href={links[i]}
            onclick={ (e) => { activeIndex = i; } }
            data-state={ (i == activeIndex) ? 'active': 'unactive' }
            class="
                main-nav cursor-pointer truncate
                data-[state=active]:bg-(--card)
                dark:data-[state=active]:text-(--foreground)
                focus-visible:border-(--ring)
                focus-visible:ring-(--ring)/50
                focus-visible:outline-(--ring)
                dark:data-[state=active]:border-(--input)
                text-(--foreground)
                dark:text-(--muted-foreground)
                inline-flex h-[calc(100%-1px)]
                flex-1 items-center
                justify-center gap-1.5 rounded-xl
                border border-transparent
                px-2 py-1 text-sm font-medium
                whitespace-nowrap transition-[color,box-shadow]
                focus-visible:ring-[3px] focus-visible:outline-1
                disabled:pointer-events-none disabled:opacity-50
                [&_svg]:pointer-events-none [&_svg]:shrink-0
                [&_svg:not([class*='size-'])]:size-4
            "
        >
            <span class="truncate">{ choice }</span>
        </a>
    {/each}
</nav>

<style>
    .main-nav {
        outline: none;
    }
</style>