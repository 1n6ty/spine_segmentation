<script lang="ts">
    import { t, locale } from "svelte-i18n";
    import { supportedLocales } from "$lib/core/i18n/index.svelte";
    import type { supportedStructures } from "$lib/features/medical-parameters/types";
    import { params } from "$lib/features/medical-parameters/store.svelte";

    type LocaleKey = typeof supportedLocales[number];

    const pagination: Record<LocaleKey, Record<supportedStructures, string>> = {
        "ru-RU": {
            vertebras: "Позвонки",
            gaps: "Диски",
            segments: "Отделы",
            overall: "Позвоночник"
        },
        "en-US": {
            vertebras: "Vertebras",
            gaps: "Disks",
            segments: "Segments",
            overall: "Spine"
        }
    };

    const structureKeys = Object.keys(pagination["en-US"]) as supportedStructures[];
</script>

<div class="flex items-center justify-between mb-6">
    <h2 class="text-2xl font-bold">{ $t('measure.header') }</h2>
    <div class="flex gap-2 overflow-x-auto px-1">
        {#each structureKeys as p}
            {@const currentLocale = ($locale || "en-US") as LocaleKey}
            <button
                onclick={() => { params.activeStructure = p; }}
                class:bg-(--primary)={ params.activeStructure === p }
                class:text-(--primary-foreground)={ params.activeStructure === p }
                class="
                cursor-pointer inline-flex items-center justify-center whitespace-nowrap text-sm
                font-medium transition-all disabled:pointer-events-none disabled:opacity-50
                shrink-0 outline-none border border-(--border) focus-visible:border-(--ring) focus-visible:ring-(--ring)/50
                focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40
                aria-invalid:border-(--destructive) hover:bg-(--primary)/90 hover:text-(--primary-foreground)
                h-8 rounded-md px-3 my-1 gap-2
                ">
                { pagination[currentLocale][p] }
            </button>
        {/each}
    </div>
</div>