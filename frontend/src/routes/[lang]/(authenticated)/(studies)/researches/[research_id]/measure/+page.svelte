<script lang="ts">
	import { locale } from 'svelte-i18n';
	import type { LocaleKey } from '$lib/core/i18n/types';
	import type { supportedStructures } from '$lib/features/medical-parameters/types';
	import { params } from '$lib/features/medical-parameters/parameters-store.svelte';
	import StructureTabs from '$lib/components/ui/measurements/StructureTabs.svelte';
	import SessionLoadingGate from '$lib/components/ui/sessions/SessionLoadingGate.svelte';
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

<SessionLoadingGate>
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
</SessionLoadingGate>
