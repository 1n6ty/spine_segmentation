<script lang="ts">
	import type { KeyFeatureType } from '$lib/components/sections/key-features/KeyFeatures.type';

	let { keyFeature }: { keyFeature: KeyFeatureType } = $props();
</script>

<div>
	<h4 class="mb-1 font-medium">{keyFeature.h4_text}</h4>
	<p class="text-sm text-(--muted-foreground)">{keyFeature.p_text}</p>
</div>
