<script lang="ts">
    import { locale } from "svelte-i18n";

    import type { InfoSubBlock } from "$lib/components/layout/PatientInfo/PatientInfo.type";

    let { info }: { info: InfoSubBlock } = $props();
</script>

<div class="space-y-1">
    <div class="flex items-start gap-3 py-2">
        <img class="opacity-40 shrink-0 mt-0.5 w-5 h-5" src={ info.icon } alt={ info.alt }/>
        <div class="flex-1 min-w-0">
            <p class="text-sm text-(--muted-foreground) truncate">{ info.title[$locale && $locale in info.title ? $locale: 'en'] }</p>
            <p class="font-medium truncate">{ info.comment }</p>
        </div>
    </div>
</div>