<script lang="ts">
    import { t } from "svelte-i18n";

    import documentImg from "$lib/assets/document.png";
</script>

<div class="bg-card text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6">
    <h2 class="text-2xl font-bold">{ $t('main.DICOM_upload_card.h2') }</h2>
    <div class="border-t border-(--border) pt-4">
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
        >
            <img src={ documentImg } alt="Document"/>
            { $t('main.DICOM_upload_card.button') }
        </button>
        <p class="text-xs text-(--muted-foreground) mt-2 text-center">
            { $t('main.DICOM_upload_card.p_under_button') }
        </p>
    </div>
</div>