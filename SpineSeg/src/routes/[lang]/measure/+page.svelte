<script lang="ts">
	import Table from "$lib/components/layout/Table/Table.svelte";

    let activeIndex = $state(0);

    import { t, locale } from "svelte-i18n";

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
                title: "Vertebraes' parameters",
                nav: "Vertebraes"
            },
            {
                title: "Parameters of disks between vertebraes",
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
    }
</script>

<div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6">
    <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold">{ $t('measure.header') }</h2>
        <div class="flex gap-2 overflow-x-auto">
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
    </div>
    <div 
        data-orientation="horizontal"
        class="
            bg-(--border) shrink-0 data-[orientation=horizontal]:h-px 
            data-[orientation=horizontal]:w-full mb-6
        ">
    </div>
    <div class="space-y-6">
        <div class="flex items-center gap-2 mb-4">
            <h3 class="text-lg font-semibold">{ pagination[$locale && $locale in pagination ? $locale: 'en'][activeIndex].title }</h3>
        </div>
        <div>
            <Table content={ { head: ["Vertebrae", "Anterior Height (mm)", "Posterior Height (mm)", "Width (mm)", "Wedge Angle (°)", "Cobb Angle (°)", "Status"], rows: [["V1", "79.3",	"61.1",	"108.5", "9.5",	"81.1",	"Attention needed"], ["V2", "75.6",	"141.4", "165",	"21.8",	"27.2", "Fine"], ["V3", "79.3",	"61.1",	"108.5", "9.5",	"81.1",	"Attention needed"]] } }/>
        </div>
        <div>
            <Table projection="frontal" content={ { head: ["Vertebrae", "Anterior Height (mm)", "Posterior Height (mm)", "Width (mm)", "Wedge Angle (°)", "Cobb Angle (°)", "Status"], rows: [["V1", "79.3",	"61.1",	"108.5", "9.5",	"81.1",	"Attention needed"], ["V2", "75.6",	"141.4", "165",	"21.8",	"27.2", "Fine"], ["V3", "79.3",	"61.1",	"108.5", "9.5",	"81.1",	"Attention needed"]] } }/>
        </div>
    </div>
</div>