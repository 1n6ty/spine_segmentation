<script lang="ts">
	import boneSVG from '$lib/assets/icons/bone.svg';

	import { t, locale } from 'svelte-i18n';
	import type { LocaleKey } from '$lib/core/i18n/types';
	import { project } from '$lib/core/project.svelte';
	import type { supportedStructures } from '$lib/features/medical-parameters/types';
	import { params } from '$lib/features/medical-parameters/parameters-store.svelte';
	import StructureTabs from '$lib/components/ui/measurements/StructureTabs.svelte';
	import MeasurementsPanel from '$lib/components/sections/measurements/MeasurementsPanel.svelte';

	const titles: Record<LocaleKey, Record<supportedStructures, string>> = {
		'ru-RU': {
			vertebrae: 'Параметры позвонков',
			gaps: 'Параметры межпозвонковых дисков',
			segments: 'Параметры стандартных и произвольных отделов',
			overall: 'Параметры позвоночника в целом'
		},
		'en-US': {
			vertebrae: "Vertebrae's parameters",
			gaps: 'Parameters of disks between vertebrae',
			segments: 'Parameters of standart and uncommon parts',
			overall: "Overall spine's parameters"
		}
	};
</script>

{#await project.session.loadingPromise then}
	{#if project.session.sessionUID}
		<div
			class="flex flex-col gap-6 rounded-xl border border-(--border) bg-(--card) p-6 text-(--card-foreground)"
		>
			<StructureTabs />
			<div
				data-orientation="horizontal"
				class="
                    mb-6 shrink-0 bg-(--border)
                    data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full
                "
			></div>
			<div class="space-y-6">
				<div class="mb-4 flex items-center gap-2">
					<h3 class="text-lg font-semibold">
						{titles[$locale as LocaleKey][params.activeStructure as supportedStructures]}
					</h3>
				</div>
				<MeasurementsPanel />
			</div>
		</div>
	{:else}
		<div
			class="flex flex-col gap-6 rounded-xl border border-(--border) bg-(--card) p-6 text-(--card-foreground)"
		>
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-2xl font-bold">{$t('editor.header')}</h2>
			</div>
			<div class="py-8 text-center text-(--muted-foreground)">
				<img src={boneSVG} alt="bone icon" class="mx-auto mb-4 h-16 w-16 opacity-20" />
				<p>{$t('no_file_loaded.p_up')}</p>
				<p class="mt-2 text-sm">{$t('no_file_loaded.p_down')}</p>
			</div>
		</div>
	{/if}
{/await}
