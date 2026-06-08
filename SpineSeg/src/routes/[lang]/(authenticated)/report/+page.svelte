<script lang="ts">
    import { t, locale } from "svelte-i18n";

    import filterSVG from "$lib/assets/report/filter.svg";
    import angleSVG from "$lib/assets/report/angle.svg";
    import downloadSVG from "$lib/assets/icons/download.svg";
    import documentSVG from "$lib/assets/icons/document.svg";

    const options: Record<string, {text: string, callback: (e: Event) => void}[]> = {
        "ru": [
            {
                text: "Всё",
                callback: (e) => {}
            },
            {
                text: "Нормально",
                callback: (e) => {}
            },
            // {
            //     text: "Не найдено",
            //     callback: (e) => {}
            // }
        ],
        "en": [
            {
                text: "All",
                callback: (e) => {}
            },
            {
                text: "Normal",
                callback: (e) => {}
            },
            // {
            //     text: "Not Scanned",
            //     callback: (e) => {}
            // }
        ]
    } as const;

    const pagination: Record<string, { title: string, nav: string }[]> = {
        "ru": [
            {
                title: "Параметры позвонков",
                nav: "Позвонки"
            },
            {
                title: "Параметры межпозвонковых дисков",
                nav: "Диски"
            },
            {
                title: "Параметры стандартных и произвольных отделов",
                nav: "Отделы"
            },
            {
                title: "Параметры позвоночника в целом",
                nav: "Позвоночник"
            }
        ],
        "en": [
            {
                title: "Vertebras' parameters",
                nav: "Vertebras"
            },
            {
                title: "Parameters of disks between vertebras",
                nav: "Disks"
            },
            {
                title: "Parameters of standart and uncommon parts",
                nav: "Parts"
            },
            {
                title: "Overall spine's parameters",
                nav: "Overall"
            }
        ]
    } as const;
    let activeIndex = $state(0);
</script>

<div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6">
    <div class="flex justify-between">
        <h2 class="text-2xl font-bold mb-4 p-1">{ $t('report.header') }</h2>
        <div class="flex gap-2 overflow-x-auto p-1">
            <button class="cursor-pointer disabled:cursor-default inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) border border-(--border) bg-(--background) text-(--foreground) hover:bg-(--accent) hover:text-(--accent-foreground) h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5">
                <img src={ downloadSVG } alt="download icon" class="w-4 h-4"/>
                PDF
            </button>
            <button class="cursor-pointer disabled:cursor-default inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) border border-(--border) bg-(--background) text-(--foreground) hover:bg-(--accent) hover:text-(--accent-foreground) h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5">
                <img src={ documentSVG } alt="document icon" class="w-4 h-4"/>
                DOCX
            </button>
        </div>
    </div>
    <div class="mb-6">
        <div class="flex items-center gap-2 mb-3">
            <h3 class="text-lg font-semibold">{ $t('report.header_overall') }</h3>
            <span class="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) transition-[color,box-shadow] overflow-hidden border-transparent text-(--primary-foreground) [a&]:hover:bg-(--primary)/90 bg-green-500">Normal</span>
        </div>
        <div class="bg-(--muted) p-4 rounded-lg">
            <ul class="space-y-1">
                <li class="flex items-start gap-2">
                    <span class="text-(--muted-foreground)">•</span>
                    <span></span>
                </li>
            </ul>
        </div>
    </div>
    <div class="flex gap-2 overflow-x-auto justify-start p-1">
        {#each pagination[$locale && $locale in pagination ? $locale: 'en'] as p, i}
            <button
                onclick={(e) => { activeIndex = i; }}
                class:bg-(--primary)={ activeIndex == i }
                class:text-(--primary-foreground)={ activeIndex == i }
                class="
                cursor-pointer inline-flex items-center justify-center whitespace-nowrap text-sm 
                font-medium transition-all disabled:pointer-events-none disabled:opacity-50 
                shrink-0 outline-none border border-(--border) focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 
                focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 
                aria-invalid:border-(--destructive) hover:bg-(--primary)/90 hover:text-(--primary-foreground)
                h-8 rounded-md px-3 gap-2
                ">
                { p.nav }
            </button>
        {/each}
    </div>
    <div data-orientation="horizontal" class="bg-(--border) shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px my-6"></div>
    <div class="mb-6">
        <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div class="flex items-center gap-2">
                <object data={filterSVG} type="image/svg+xml" title="filter icon" class="w-4 h-4"></object>
                <span class="text-sm font-medium">{ $t('report.filter_by') }</span>
            </div>
            <div class="flex gap-2 overflow-x-auto p-1">
                <button class="cursor-pointer disabled:cursor-default inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) border border-(--border) bg-(--background) text-(--foreground) hover:bg-(--accent) hover:text-(--accent-foreground) h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5">{ $t('report.expand') }</button>
                <button class="cursor-pointer disabled:cursor-default inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) border border-(--border) bg-(--background) text-(--foreground) hover:bg-(--accent) hover:text-(--accent-foreground) h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5">{ $t('report.collapse') }</button>
            </div>
        </div>
        <div class="flex flex-wrap gap-2">
            {#each options[$locale && $locale in options ? $locale: 'en'] as option, i}
                <button class={`${i === 0 ? 'bg-(--primary) hover:bg-(--primary)/90 text-(--primary-foreground)' : 'hover:bg-(--accent) text-(--foreground)'} ${i != 0 ? 'border border-(--border)': ''} cursor-pointer disabled:cursor-default inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-(--ring) focus-visible:ring-(--ring_/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) border-(--border) h-8 rounded-md px-3 has-[>svg]:px-2.5 gap-2`}>
                    { option.text }
                    <span class="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) transition-[color,box-shadow] overflow-hidden border-transparent bg-(--secondary) text-(--secondary-foreground) [a&]:hover:bg-(--secondary)/90 ml-1">
                        24
                    </span>
                </button>
            {/each}
        </div>
    </div>
    <h3 class="text-lg font-semibold mb-4">Диагностика</h3>
    <div class="space-y-6">
        <div>
            <h4 class="font-semibold mb-3 text-(--muted-foreground) flex items-center gap-2">
                Сагиттальная проекция
                <span class="inline-flex items-center justify-center rounded-md border border-(--border) px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) transition-[color,box-shadow] overflow-hidden text-(--foreground) [a&]:hover:bg-(--accent) [a&]:hover:text-(--accent-foreground)">
                    24 позвонка
                </span>
            </h4>
            <div class="space-y-2">
                <div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) overflow-hidden transition-all opacity-60">
                    <button class="w-full p-4 flex items-center justify-between hover:bg-(--muted)/50 transition-colors">
                        <div class="flex items-center gap-3">
                            <img src={ angleSVG } alt="toggle icon" class="rotate-90 cursor-pointer w-5 h-5 text-(--muted-foreground)" />
                            <h4 class="font-semibold">C2</h4>
                        </div>
                        <span class="inline-flex items-center justify-center rounded-md border border-(--border) px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) transition-[color,box-shadow] overflow-hidden text-(--foreground) [a&]:hover:bg-(--accent) [a&]:hover:text-(--accent-foreground) bg-gray-100">
                            Scanned
                        </span>
                    </button>
                    <div class="px-4 border-t border-(--border)">
                        <div class="pt-4">
                            <p class="text-sm font-medium mb-2">Findings:</p>
                            <ul class="text-sm space-y-1 mb-4">
                                <li class="flex items-start gap-2">
                                    <span class="text-(--muted-foreground)">•</span>
                                    <span>Vertebra not annotated in current study</span>
                                </li>
                            </ul>
                        </div>
                        <div class="text-sm font-medium mb-2">
                            <p class="text-sm font-medium mb-2">Recomendations:</p>
                            <ul class="text-sm space-y-1 mb-4">
                                <li class="flex items-start gap-2">
                                    <span class="text-(--muted-foreground)">•</span>
                                    <span>Vertebra not annotated in current study</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) overflow-hidden transition-all opacity-60">
                    <button class="w-full p-4 flex items-center justify-between hover:bg-(--muted)/50 transition-colors">
                        <div class="flex items-center gap-3">
                            <img src={ angleSVG } alt="toggle icon" class="cursor-pointer w-5 h-5 text-(--muted-foreground)" />
                            <h4 class="font-semibold">C3</h4>
                        </div>
                        <span class="inline-flex items-center justify-center rounded-md border border-(--border) px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) transition-[color,box-shadow] overflow-hidden text-(--foreground) [a&]:hover:bg-(--accent) [a&]:hover:text-(--accent-foreground) bg-gray-100">
                            Scanned
                        </span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>