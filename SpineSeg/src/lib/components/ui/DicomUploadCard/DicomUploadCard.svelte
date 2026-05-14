<script lang="ts">
    import { t, locale } from "svelte-i18n";

    import acceptedSVG from "$lib/assets/icons/accepted.svg";
    import documentSVG from "$lib/assets/icons/document.svg";
    import againSVG from "$lib/assets/icons/again.svg";
	import type { UploadBtnType } from "$lib/components/ui/DicomUploadCard/DicomUploadCard.type";

	import { page } from '$app/state';
    import { goto } from '$app/navigation';
	import { supportedLocales } from "$lib/core/i18n/index.svelte";
	import { project } from "$lib/core/project.svelte";
	import type { Projection } from "$lib/features/dicom/types";
	import { registry } from "$lib/core/session/registry.svelte";
	import { SessionService } from "$lib/core/session/session.svelte";

    let fileInput: HTMLInputElement;
    let currentProjection: "frontal" | "side";

    const handleFileChange = async (event: Event) => {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        project.session.uploadFile(file, currentProjection).then(() => {
            const currentPath = page.url.pathname;
            
            // Check if path is exactly the locale (e.g., "/en" or "/en/")
            const isAtLocaleRoot = currentPath === `/${$locale}` || currentPath === `/${$locale}/`;

            if (isAtLocaleRoot) {
                goto(`/${$locale}/patient`);
            } else {
                console.log("Not at locale root, skipping navigation");
            }
        });
    };

    const openFileDialog = (projection: Projection) => {
        currentProjection = projection;
        fileInput.click();
    };

    const upload_projections: Record<typeof supportedLocales[number], UploadBtnType[]> = {
        "ru-RU": [
            {
                label: "Сагиттальная проекция",
                projection: "side",
                accepted: "Файл сагиттальной проекции загружен",
                acceptedComment: "Для загрузки нового файла необходимо очистить сессию или начать новую",
                btn: "Загрузить DICOM файл сагиттальной проекции",
                id: "side-dicom-upload",
                callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }) => {openFileDialog("side");}
            },
            {
                label: "Фронтальная проекция",
                projection: "frontal",
                accepted: "Файл фронтальной проекции загружен",
                acceptedComment: "Для загрузки нового файла необходимо очистить сессию или начать новую",
                btn: "Загрузить DICOM файл фронтальной проекции",
                id: "frontal-dicom-upload",
                callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }) => {openFileDialog("frontal");}
            }
        ],
        "en-US": [
            {
                label: "Lateral View",
                projection: "side",
                accepted: "Lateral view uploaded",
                acceptedComment: "Clear or create new session to upload a new file",
                btn: "Upload DICOM file of Lateral projection",
                id: "side-dicom-upload",
                callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }) => {openFileDialog("side");}
            },
            {
                label: "Frontal View",
                projection: "frontal",
                accepted: "Frontal view uploaded",
                acceptedComment: "Clear or create new session to upload a new file",
                btn: "Upload DICOM file of Frontal projection",
                id: "frontal-dicom-upload",
                callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }) => {openFileDialog("frontal");}
            }
        ]
    } as const;

    $effect(() => {
        const side = project.session.projections.side;
        const frontal = project.session.projections.frontal;
        
        // This log confirms the effect is tracking correctly
        console.log("State change detected, requesting save...");
        
        // Trigger your debounced save
        project.session.requestSave();
    });

    function handleClear(e: MouseEvent) {
        e.preventDefault();

        registry.delete(project.session.sessionUID);

        project.session.destroy();
        project.session = new SessionService(null);
    }

</script>

<input
    type="file"
    accept=".dcm,application/dicom"
    bind:this={ fileInput }
    onchange={ handleFileChange }
    class="hidden"
/>

<div class="bg-card text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6">
    <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold">{ $t('main.DICOM_upload_card.h2') }</h2>
        {#if (project.session.projections.side.hash || project.session.projections.frontal.hash)}
            <div class="flex items-end gap-2">
                <button onclick={ handleClear } class="cursor-pointer inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_img]:pointer-events-none [&_img:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-(--ring) focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) bg-(--destructive) text-white hover:bg-(--destructive)/90 focus-visible:ring-(--destructive)/20 h-8 rounded-md px-3 has-[>img]:px-2.5 gap-1">
                    <img src={againSVG} style="filter: invert(100%) brightness(200%);" alt="Clear the session"/>
                    <p class="sm:inline hidden">{ $t('main.DICOM_upload_card.clear_session') }</p>
                </button>
            </div>
        {/if}
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {#each upload_projections[$locale as typeof supportedLocales[number]] as up}
            <div>
                <label class="block text-sm font-medium mb-2" for="side-dicom">{ up.label }</label>
                {#if (project.session.projections[up.projection].hash)}
                    <div class="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <img class="w-5 h-5 shrink-0" src={ acceptedSVG } alt="accepted" style="filter: invert(48%) sepia(82%) saturate(455%) hue-rotate(94deg) brightness(93%) contrast(101%);"/>
                        <div class="flex-1">
                            <p class="text-sm font-medium text-green-800">{ up.accepted }</p>
                            <p class="text-xs text-green-600">{ up.acceptedComment }</p>
                        </div>
                    </div>
                {:else}
                    <button
                        class="cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all
                        disabled:pointer-events-none disabled:opacity-50
                        [&_img]:pointer-events-none [&_img:not([class*='size-'])]:size-4 shrink-0 [&_img]:shrink-0
                        focus-visible:outline-none
                        focus-visible:ring-2
                        focus-visible:ring-(--ring)
                        focus-visible:ring-offset-2
                        focus-visible:ring-offset-(--background)
                        aria-invalid:ring-(--destructive)/20
                        dark:aria-invalid:ring-(--destructive)/40
                        aria-invalid:border-(--destructive)
                        bg-(--secondary) text-(--secondary-foreground)
                        hover:bg-(--secondary)/80
                        h-9 px-4 py-2 has-[>img]:px-3 w-full"
                        id={ up.id } onclick={ (e) => {up.callback(e);} }
                    >
                        <div class="truncate flex">
                            <img src={ documentSVG } alt="Document"/>
                            { up.btn }
                        </div>
                    </button>
                {/if}
            </div>
        {/each}
    </div>
    <div class="border-t border-(--border) pt-4">
        <p class="text-xs text-(--muted-foreground) mt-2 text-center">
            {#if (project.session.projections.side.hash && project.session.projections.frontal.hash)}
                <img class="inline w-5 h-5 shrink-0" src={ acceptedSVG } alt="accepted" style="filter: invert(48%) sepia(82%) saturate(455%) hue-rotate(94deg) brightness(93%) contrast(101%);"/>
                { $t('main.DICOM_upload_card.p_under_button_accepted') }
            {:else}
                { $t('main.DICOM_upload_card.p_under_button') }
            {/if}
        </p>
    </div>
</div>