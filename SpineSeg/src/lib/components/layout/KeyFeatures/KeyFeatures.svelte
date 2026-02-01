<script lang="ts">
    import { locale } from "svelte-i18n";

    import type { KeyFeatureType } from "./KeyFeatures.type";
    const keyFeatures: Record<string, KeyFeatureType[]> = {
        en: [
            {
                "h4_text": "📊 DICOM Support",
                "p_text": "Upload and parse standard DICOM medical files"
            },
            {
                "h4_text": "✏️ Interactive Annotation",
                "p_text": "Edit 4-point polygons for vertebrae marking"
            },
            {
                "h4_text": "🏥 Diagnostic Reports",
                "p_text": "Generate detailed findings and recommendations"
            },
            {
                "h4_text": "🔍 Dual View Analysis",
                "p_text": "Side and frontal projection visualization"
            },
            {
                "h4_text": "📈 Automated Measurements",
                "p_text": "Calculate heights, angles, and compression ratios"
            },
            {
                "h4_text": "⚕️ Clinical Decision Support",
                "p_text": "AI-assisted severity classification and treatment suggestions"
            }
        ],
        ru: [
            {
                "h4_text": "📊 Поддержка DICOM",
                "p_text": "Загрузка и обработка стандартных медицинских файлов DICOM"
            },
            {
                "h4_text": "✏️ Интерактивная разметка",
                "p_text": "Редактирование 4-точечных полигонов для маркировки позвонков"
            },
            {
                "h4_text": "🏥 Диагностические отчёты",
                "p_text": "Формирование подробных заключений и рекомендаций"
            },
            {
                "h4_text": "🔍 Двухпроекционный анализ",
                "p_text": "Визуализация сагиттальной и фронтальной проекций"
            },
            {
                "h4_text": "📈 Автоматические измерения",
                "p_text": "Расчёт высот, углов и коэффициентов"
            },
            {
                "h4_text": "⚕️ Поддержка клинических решений",
                "p_text": "ИИ-ассистированная классификация тяжести и рекомендации по лечению"
            }
        ]
    } as const;
</script>

<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    {#each keyFeatures[$locale && $locale in keyFeatures ? $locale: 'en'] as keyFeature}
        <div>
            <h4 class="font-medium mb-1">{ keyFeature.h4_text }</h4>
            <p class="text-sm text-(--muted-foreground)">{ keyFeature.p_text }</p>
        </div>
    {/each}
</div>
