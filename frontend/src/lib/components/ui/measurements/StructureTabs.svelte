<script lang="ts">
	import { t, locale } from 'svelte-i18n';
	import type { LocaleKey } from '$lib/core/i18n/types';
	import type { supportedStructures } from '$lib/features/medical-parameters/types';
	import { params } from '$lib/features/medical-parameters/parameters-store.svelte';

	const pagination: Record<LocaleKey, Record<supportedStructures, string>> = {
		'ru-RU': {
			vertebrae: 'Позвонки',
			gaps: 'Диски',
			segments: 'Отделы',
			overall: 'Позвоночник'
		},
		'en-US': {
			vertebrae: 'Vertebrae',
			gaps: 'Disks',
			segments: 'Segments',
			overall: 'Spine'
		}
	};

	const structureKeys = Object.keys(pagination['en-US']) as supportedStructures[];
</script>

<div class="mb-6 flex items-center justify-between">
	<h2 class="text-2xl font-bold">{$t('measure.header')}</h2>
	<div class="flex gap-2 overflow-x-auto px-1">
		{#each structureKeys as p}
			{@const currentLocale = ($locale || 'en-US') as LocaleKey}
			<button
				onclick={() => {
					params.activeStructure = p;
				}}
				class:bg-(--primary)={params.activeStructure === p}
				class:text-(--primary-foreground)={params.activeStructure === p}
				class="
                my-1 inline-flex h-8 shrink-0 cursor-pointer items-center
                justify-center gap-2 rounded-md border
                border-(--border) px-3 text-sm font-medium whitespace-nowrap transition-all
                outline-none hover:bg-(--primary)/90 hover:text-(--primary-foreground)
                focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50
                disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40
                "
			>
				{pagination[currentLocale][p]}
			</button>
		{/each}
	</div>
</div>
