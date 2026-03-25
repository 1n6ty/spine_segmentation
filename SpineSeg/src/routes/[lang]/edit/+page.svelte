<script lang="ts">
    import { locale, t } from "svelte-i18n";

    import boneSVG from "$lib/assets/icons/bone.svg";

    import XrayEditorCard from "$lib/components/ui/XrayEditorCard.svelte";
	import { dicomSidePixelDataStore, dicomFrontalPixelDataStore } from "$lib/stores/dicom/dicom.store";

    const instructions: Record<string, string[]> = {
        "ru": [
            "Используйте колесо мыши, чтобы приблизить или отдалить изображение",
            "Перетаскивайте мышью, чтобы перемещаться по изображению",
            "Нажмите «Добавить полигон», чтобы начать разметку позвонка",
            "Кликните по 4 точкам на изображении, чтобы определить границы позвонка (углы)",
            "Нажмите на любой полигон, чтобы выбрать его, затем перетаскивайте отдельные точки для изменения формы",
            "Выберите полигон и нажмите «Удалить», чтобы удалить его",
            "Мини-карта в правом нижнем углу показывает текущую область просмотра"
        ],
        "en": [
            "Use Mouse Wheel to zoom in/out on the image",
            "Drag to pan around the image",
            "Click 'Add Polygon' to start annotating a vertebrae",
            "Click 4 points on the image to define the vertebra boundaries (corners)",
            "Click on any polygon to select it, then click on individual points to move them",
            "Select a polygon and click 'Delete' to remove it",
            "The minimap in the bottom-right corner shows your current viewport"
        ]
    } as const;
</script>


{#if $dicomSidePixelDataStore || $dicomFrontalPixelDataStore}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {#if $dicomSidePixelDataStore}
            <XrayEditorCard projection="side" />
        {/if}
        {#if $dicomFrontalPixelDataStore}
            <XrayEditorCard projection="frontal" />
        {/if}
    </div>
    <div class="bg-(--muted) p-4 rounded-lg">
        <h3 class="font-semibold mb-2">{ $t('editor.instructions.header') }</h3>
        <ul class="text-sm space-y-1 text-(--muted-foreground)">
            {#each instructions[$locale && $locale in instructions ? $locale: 'en'] as inst}
                <li>{ inst }</li>
            {/each}
        </ul>
    </div>
{:else}
    <div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold">{ $t('editor.header') }</h2>
        </div>
        <div class="text-center text-(--muted-foreground) py-8">
            <img src={boneSVG} alt="bone icon" class="w-16 h-16 mx-auto mb-4 opacity-20"/>
            <p>{ $t('no_file_loaded.p_up') }</p>
            <p class="text-sm mt-2">{ $t('no_file_loaded.p_down') }</p>
        </div>
    </div>
{/if}