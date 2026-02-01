<script lang="ts">
    import { t } from "svelte-i18n";

    import vertebrae from '$lib/assets/vertebrae.png';

    import KeyFeatures from "$lib/components/layout/KeyFeatures/KeyFeatures.svelte";
</script>

<div class="text-center py-16">
    <img src={ vertebrae } alt="Vertebrae" class="w-16 h-16 mx-auto mb-4 text-(--muted-foreground)"/>
    <h2 class="text-2xl font-semibold mb-2">{ $t('main.welcome_h2') }</h2>
    <p class="text-(--muted-foreground) mb-6 max-w-md mx-auto">{ $t('main.p') }</p>
    <div class="max-w-2xl mx-auto bg-(--muted) p-6 rounded-lg text-left">
        <h3 class="font-semibold mb-3">{ $t('main.key_features.h3') }</h3>
        <KeyFeatures />
    </div>
</div>
