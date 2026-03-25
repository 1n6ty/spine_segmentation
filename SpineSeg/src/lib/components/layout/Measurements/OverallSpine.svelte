<script lang="ts">
    import { locale, t } from "svelte-i18n";
    
    let { parametersList, pagination } = $props();
</script>


<div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6 border-l-4 border-l-blue-500">
    <h4 class="font-semibold mb-4 flex items-center gap-2">
        <span class="inline-flex items-center justify-center rounded-md border border-(--border) px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) transition-[color,box-shadow] overflow-hidden text-(--foreground) [a&]:hover:bg-(--accent) [a&]:hover:text-(--accent-foreground)">{ $t('side_projection') }</span>
    </h4>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        {#each Object.keys((parametersList.side.overall.pl.length > 0) ? parametersList.side.overall.pl[0].params: {}) as plKey}
            <div class="p-4 bg-(--muted) rounded-lg">
                <p class="text-sm font-medium mb-0.5">{ (parametersList.side.overall as any)[$locale && $locale in pagination ? $locale: 'en'][plKey].name }</p>
                <p class="text-lg font-semibold">{ parametersList.side.overall.pl[0].params[plKey as keyof typeof parametersList.side.overall.pl[0]['params']].val } { $t(`units.${(parametersList.side.overall as any)[$locale && $locale in pagination ? $locale: 'en'][plKey].type}`) }</p>
            </div>
        {/each}
    </div>
</div>
<div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6 border-l-4 border-l-blue-500">
    <h4 class="font-semibold mb-4 flex items-center gap-2">
        <span class="inline-flex items-center justify-center rounded-md border border-(--border) px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) transition-[color,box-shadow] overflow-hidden text-(--foreground) [a&]:hover:bg-(--accent) [a&]:hover:text-(--accent-foreground)">{ $t('frontal_projection') }</span>
    </h4>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        {#each Object.keys((parametersList.frontal.overall.pl.length > 0) ? parametersList.frontal.overall.pl[0].params: {}) as plKey}
            <div class="p-4 bg-(--muted) rounded-lg">
                <p class="text-sm font-medium mb-0.5">{ (parametersList.frontal.overall as any)[$locale && $locale in pagination ? $locale: 'en'][plKey].name }</p>
                <p class="text-lg font-semibold">{ parametersList.frontal.overall.pl[0].params[plKey as keyof typeof parametersList.frontal.overall.pl[0]['params']].val } { $t(`units.${(parametersList.frontal.overall as any)[$locale && $locale in pagination ? $locale: 'en'][plKey].type}`) }</p>
            </div>
        {/each}
    </div>
</div>