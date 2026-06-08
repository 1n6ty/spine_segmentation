<script lang="ts">
    import type { supportedLocales } from "$lib/core/i18n/index.svelte";
    import { parametersNames } from "$lib/features/medical-parameters/config";
    import { params } from "$lib/features/medical-parameters/store.svelte";
    import { locale, t } from "svelte-i18n";
    
    type LocaleKey = typeof supportedLocales[number];
    
    type ParameterKey = keyof typeof parametersNames.side['en-US']['overall'];
    
    $: currentLocale = ($locale || 'en-US') as LocaleKey;
</script>

<div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6 border-l-4 border-l-blue-500">
    <h4 class="font-semibold mb-4 flex items-center gap-2">
        <span class="inline-flex items-center justify-center rounded-md border border-(--border) px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 text-(--foreground)">
            { $t('side_projection') }
        </span>
    </h4>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        {#each Object.keys(params.side.overall?.params || {}) as plKey}
            {@const key = plKey as ParameterKey}
            {@const config = parametersNames.side[currentLocale]?.overall[key]}
            {@const paramData = params.side.overall?.params?.[key]}
            
            {#if config && paramData && paramData.val !== null}
                <div class="p-4 bg-(--muted) rounded-lg">
                    <p class="text-sm font-medium mb-0.5">{ config.name }</p>
                    <p class="text-lg font-semibold">
                        { paramData.val } 
                        { $t(`units.${config.type}`) }
                    </p>
                </div>
            {:else}
                <div class="p-4 bg-(--muted) rounded-lg">
                    <p class="text-sm font-medium mb-0.5">{ config.name }</p>
                    <p class="text-lg font-semibold">
                        { $t('not_enough') }
                    </p>
                </div>
            {/if}
        {/each}
    </div>
</div>

<div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6 border-l-4 border-l-blue-500">
    <h4 class="font-semibold mb-4 flex items-center gap-2">
        <span class="inline-flex items-center justify-center rounded-md border border-(--border) px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 text-(--foreground)">
            { $t('frontal_projection') }
        </span>
    </h4>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        {#each Object.keys(params.frontal.overall?.params || {}) as plKey}
            {@const key = plKey as ParameterKey}
            {@const config = parametersNames.frontal[currentLocale]?.overall[key]}
            {@const paramData = params.frontal.overall?.params?.[key]}
            
            {#if config && paramData && paramData.val !== null}
                <div class="p-4 bg-(--muted) rounded-lg">
                    <p class="text-sm font-medium mb-0.5">{ config.name }</p>
                    <p class="text-lg font-semibold">
                        { paramData.val } 
                        { $t(`units.${config.type}`) }
                    </p>
                </div>
            {:else}
                <div class="p-4 bg-(--muted) rounded-lg">
                    <p class="text-sm font-medium mb-0.5">{ config.name }</p>
                    <p class="text-lg font-semibold">
                        { $t('not_enough') }
                    </p>
                </div>
            {/if}
        {/each}
    </div>
</div>