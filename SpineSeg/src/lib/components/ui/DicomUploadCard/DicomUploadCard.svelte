<script lang="ts">
    import { t, locale } from "svelte-i18n";

    import documentImg from "$lib/assets/icons/document.svg";
	import type { UploadBtnType } from "$lib/components/ui/DicomUploadCard/DicomUploadCard.type";

	import { parseAndStoreDicom } from "$lib/features/dicom";
	import { goto } from "$app/navigation";
    import { page } from '$app/state';

    let fileInput: HTMLInputElement;
    let currentProjection: "frontal" | "side";

    const handleFileChange = async (event: Event) => {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        parseAndStoreDicom(file, currentProjection).then(() => {
            if (page.url.pathname.split('/').length == 2) {
                goto(`/${$locale ? $locale : 'en'}/patient`);
            }
        });
    };

    const openFileDialog = (projection: "side" | "frontal") => {
        currentProjection = projection;
        fileInput.click();
    };

    const upload_projections: Record<string, UploadBtnType[]> = {
        "ru": [
            {
                lable: "Сагиттальная проекция",
                btn: "Загрузить DICOM файл сагиттальной проекции",
                id: "side-dicom-upload",
                callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }) => {openFileDialog("side");}
            },
            {
                lable: "Фронтальная проекция",
                btn: "Загрузить DICOM файл фронтальной проекции",
                id: "frontal-dicom-upload",
                callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }) => {openFileDialog("frontal");}
            }
        ],
        "en": [
            {
                lable: "Lateral View",
                btn: "Upload DICOM file of Lateral projection",
                id: "side-dicom-upload",
                callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }) => {openFileDialog("side");}
            },
            {
                lable: "Frontal View",
                btn: "Upload DICOM file of Frontal projection",
                id: "frontal-dicom-upload",
                callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }) => {openFileDialog("frontal");}
            }
        ]
    } as const;

</script>

<input
    type="file"
    accept=".dcm,application/dicom"
    bind:this={ fileInput }
    onchange={ handleFileChange }
    class="hidden"
/>

<div class="bg-card text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6">
    <h2 class="text-2xl font-bold">{ $t('main.DICOM_upload_card.h2') }</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {#each upload_projections[$locale && $locale in upload_projections ? $locale: 'en'] as up}
            <div>
                <label class="block text-sm font-medium mb-2" for="side-dicom">{ up.lable }</label>
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
                        <img src={ documentImg } alt="Document"/>
                        { up.btn }
                    </div>
                </button>
            </div>
        {/each}
    </div>
    <div class="border-t border-(--border) pt-4">
        <p class="text-xs text-(--muted-foreground) mt-2 text-center">
            { $t('main.DICOM_upload_card.p_under_button') }
        </p>
    </div>
</div>