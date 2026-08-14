<script lang="ts">
	import { locale } from 'svelte-i18n';
	import type { LocaleKey } from '$lib/core/i18n/types';

	import type { InfoSubBlock } from '$lib/components/sections/patient-info/PatientInfo.type';

	let { info }: { info: InfoSubBlock } = $props();

	let currentLocale = $derived(($locale || 'en-US') as LocaleKey);
</script>

<div class="space-y-1">
	<div class="flex items-start gap-3 py-2">
		<img class="mt-0.5 h-5 w-5 shrink-0 opacity-40" src={info.icon} alt={info.alt} />
		<div class="min-w-0 flex-1">
			<p class="truncate text-sm text-(--muted-foreground)">
				{info.title[currentLocale]}
			</p>
			<p class="truncate font-medium">{info.comment}</p>
		</div>
	</div>
</div>
