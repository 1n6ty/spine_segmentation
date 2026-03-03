<script lang="ts">
    import type { KeyFeatureType } from "$lib/components/layout/KeyFeatures/KeyFeatures.type";

    let { keyFeature }: { keyFeature: KeyFeatureType } = $props();
</script>

<div>
    <h4 class="font-medium mb-1">{ keyFeature.h4_text }</h4>
    <p class="text-sm text-(--muted-foreground)">{ keyFeature.p_text }</p>
</div>