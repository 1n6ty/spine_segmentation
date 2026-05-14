<script lang="ts">
    import { t } from "svelte-i18n";

    import documentSVG from "$lib/assets/icons/document.svg";
    import boneSVG from "$lib/assets/icons/bone.svg";

    import PatientInfo from "$lib/components/layout/PatientInfo/PatientInfo.svelte";
	import { project } from "$lib/core/project.svelte";
</script>

{#if (project.session.projections.side.patient || project.session.projections.frontal.patient)}
    <div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold">{ $t('patient.title') }</h2>
            <span class="sm:inline-flex hidden items-center justify-center rounded-md border border-(--border) px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>img]:size-3 [&>img]:pointer-events-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) transition-[color,box-shadow] overflow-hidden text-(--foreground) [a&]:hover:bg-(--accent) [a&]:hover:text-(--accent-foreground) gap-1">
                <img src={ documentSVG } alt="Document icon" class="w-4 h-4"/>
                DICOM Metadata
            </span>
        </div>
        <PatientInfo />
        <div data-orientation="horizontal" class="bg-(--border) shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px my-6"></div>
        <div class="p-4 bg-(--muted) rounded-lg text-sm text-(--muted-foreground)">
            <p class="font-medium mb-1">{ $t('patient.privacy_note.title') }</p>
            <p>{ $t('patient.privacy_note.comment') }</p>
        </div>
    </div>
{:else}    
    <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold">{ $t('patient.title') }</h2>
    </div>
    <div class="text-center text-(--muted-foreground) py-8">
        <img src={boneSVG} alt="bone icon" class="w-16 h-16 mx-auto mb-4 opacity-20"/>
        <p>{ $t('no_file_loaded.p_up') }</p>
        <p class="text-sm mt-2">{ $t('no_file_loaded.p_down') }</p>
    </div>
{/if}