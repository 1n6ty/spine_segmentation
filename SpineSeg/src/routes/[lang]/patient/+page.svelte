<script lang="ts">
    import { t } from "svelte-i18n";

    import documentImg from "$lib/assets/document.png";
	import type { PatientInfoBlock } from "./page.type";

    let info: PatientInfoBlock[] = [
        {
            title: "Patient Demographics #1",
            icon: documentImg,
            subBlocks: [
                {
                    icon: documentImg,
                    title: "Patient Name",
                    comment: "Demo Patient"
                },
                {
                    icon: documentImg,
                    title: "Patient Name",
                    comment: "Demo Patient"
                },
                {
                    icon: documentImg,
                    title: "Patient Name",
                    comment: "Demo Patient"
                }
            ]
        },
        {
            title: "Patient Demographics #2",
            icon: documentImg,
            subBlocks: [
                {
                    icon: documentImg,
                    title: "Patient Name",
                    comment: "Demo Patient"
                },
                {
                    icon: documentImg,
                    title: "Patient Name",
                    comment: "Demo Patient"
                },
                {
                    icon: documentImg,
                    title: "Patient Name",
                    comment: "Demo Patient"
                }
            ]
        }
    ]
</script>

<div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6">
    <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold">{ $t('patient.title') }</h2>
        <span class="inline-flex items-center justify-center rounded-md border border-(--border) px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>img]:size-3 [&>img]:pointer-events-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) transition-[color,box-shadow] overflow-hidden text-(--foreground) [a&]:hover:bg-(--accent) [a&]:hover:text-(--accent-foreground) gap-1">
            <img src={ documentImg } alt="Document"/>
            DICOM Metadata
        </span>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#each info as iblock}
            <div>
                <h3 class="font-semibold mb-4 flex items-center gap-2">
                    <img src={ iblock.icon } alt="block icon" class="w-4 h-4"/>
                    { iblock.title }
                </h3>
                {#each iblock.subBlocks as sb}
                    <div class="space-y-1">
                        <div class="flex items-start gap-3 py-2">
                            <img class="text-(--muted-foreground) shrink-0 mt-0.5 w-5 h-5" src={ sb.icon } alt="sub-block icon"/>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm text-(--muted-foreground) truncate">{ sb.title }</p>
                                <p class="font-medium truncate">{ sb.comment }</p>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/each}
    </div>
    <div data-orientation="horizontal" class="bg-(--border) shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px my-6"></div>
    <div class="p-4 bg-(--muted) rounded-lg text-sm text-(--muted-foreground)">
        <p class="font-medium mb-1">{ $t('patient.privacy_note.title') }</p>
        <p>{ $t('patient.privacy_note.comment') }</p>
    </div>
</div>