<script lang="ts">
    import boneSVG from "$lib/assets/icons/bone.svg";

    import { t, locale } from "svelte-i18n";
    import { supportedLocales } from "$lib/core/i18n/index.svelte";
	import { project } from "$lib/core/project.svelte";
	import type { supportedStructures } from "$lib/features/medical-parameters/types";
	import { params } from "$lib/features/medical-parameters/store.svelte";
	import Navigation from "$lib/components/layout/Measurements/Navigation.svelte";
	import View from "$lib/components/layout/Measurements/View.svelte";
	
    type LocaleKey = typeof supportedLocales[number];

    const titles: Record<LocaleKey, Record<supportedStructures, string>> = {
        "ru-RU": {
            vertebras: "Параметры позвонков",
            gaps: "Параметры межпозвонковых дисков",
            segments: "Параметры стандартных и произвольных отделов",
            overall: "Параметры позвоночника в целом"
        },
        "en-US": {
            vertebras: "Vertebras' parameters",
            gaps: "Parameters of disks between vertebras",
            segments: "Parameters of standart and uncommon parts",
            overall: "Overall spine's parameters"
        }
    };
</script>

{#await project.session.loadingPromise then }
    {#if project.session.sessionUID}
        <div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6">
            <Navigation />
            <div
                data-orientation="horizontal"
                class="
                    bg-(--border) shrink-0 data-[orientation=horizontal]:h-px
                    data-[orientation=horizontal]:w-full mb-6
                ">
            </div>
            <div class="space-y-6">
                <div class="flex items-center gap-2 mb-4">
                    <h3 class="text-lg font-semibold">{ titles[$locale as LocaleKey][params.activeStructure as supportedStructures] }</h3>
                </div>
                <View />
            </div>
        </div>
    {:else}
        <div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6">
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-2xl font-bold">{ $t('editor.header') }</h2>
            </div>
            <div class="text-center text-(--muted-foreground) py-8">
                <img src={boneSVG} alt="bone icon" class="w-16 h-16 mx-auto mb-4 opacity-20"/>
                <p>{ $t('no_file_loaded.p_up') }</p>
                <p class="text-sm mt-2">{ $t('no_file_loaded.p_down') }</p>
            </div>
        </div>
    {/if}
{/await}
