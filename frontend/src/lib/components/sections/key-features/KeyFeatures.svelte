<script lang="ts">
	import { locale } from 'svelte-i18n';
	import type { LocaleKey } from '$lib/core/i18n/types';
	import type { KeyFeatureType } from '$lib/components/sections/key-features/KeyFeatures.type';
	import Feature from '$lib/components/sections/key-features/Feature.svelte';

	let currentLocale = $derived(($locale || 'en-US') as LocaleKey);

	const keyFeatures: Record<LocaleKey, KeyFeatureType[]> = {
		'en-US': [
			{
				h4_text: '📊 DICOM Support',
				p_text: 'Upload and parse standard DICOM medical files'
			},
			{
				h4_text: '✏️ Interactive Annotation',
				p_text: 'Edit 4-point polygons for vertebrae marking'
			},
			{
				h4_text: '🏥 Diagnostic Reports',
				p_text: 'Generate detailed findings and recommendations'
			},
			{
				h4_text: '🔍 Dual View Analysis',
				p_text: 'Side and frontal projection visualization'
			},
			{
				h4_text: '📈 Automated Measurements',
				p_text: 'Calculate heights, angles, and compression ratios'
			},
			{
				h4_text: '⚕️ Clinical Decision Support',
				p_text: 'AI-assisted severity classification and treatment suggestions'
			}
		],
		'ru-RU': [
			{
				h4_text: '📊 Поддержка DICOM',
				p_text: 'Загрузка и обработка стандартных медицинских файлов DICOM'
			},
			{
				h4_text: '✏️ Интерактивная разметка',
				p_text: 'Редактирование 4-точечных полигонов для маркировки позвонков'
			},
			{
				h4_text: '🏥 Диагностические отчёты',
				p_text: 'Формирование подробных заключений и рекомендаций'
			},
			{
				h4_text: '🔍 Двухпроекционный анализ',
				p_text: 'Визуализация сагиттальной и фронтальной проекций'
			},
			{
				h4_text: '📈 Автоматические измерения',
				p_text: 'Расчёт высот, углов и коэффициентов'
			},
			{
				h4_text: '⚕️ Поддержка клинических решений',
				p_text: 'ИИ-ассистированная классификация тяжести и рекомендации по лечению'
			}
		]
	} as const;
</script>

<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
	{#each keyFeatures[currentLocale] as keyFeature}
		<Feature {keyFeature} />
	{/each}
</div>
