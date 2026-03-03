<script lang="ts">
    import { locale } from "svelte-i18n";

    import { currentPatientStore } from "$lib/stores/patient/patient.store";
    import { dicomStore } from "$lib/stores/dicom/dicom.store";

    import documentSVG from "$lib/assets/icons/document.svg";
    import userSVG from "$lib/assets/icons/user.svg";
    import imageSVG from "$lib/assets/icons/image.svg";
    import facilitySVG from "$lib/assets/icons/facility.svg";
    import calendarSVG from "$lib/assets/icons/calendar.svg";
    import hashtagSVG from "$lib/assets/icons/hashtag.svg";

    import type { PatientInfoBlock } from "$lib/components/layout/PatientInfo/PatientInfo.type";

    import InfoBlock from "$lib/components/layout/PatientInfo/InfoBlock.svelte";
	import { getPatientAge, parseDicomDate } from "$lib/utils/dicom";
	import { frontalProjectionExistsInStore, sideProjectionExistsInStore } from "$lib/utils/patient";

    const localeMap = {
        ru: "Не найдено",
        en: "Not found"
    } as const;
    let localePlaceholder: string = $derived(localeMap[($locale as keyof typeof localeMap) ?? 'en']);

    let info: PatientInfoBlock[] = $derived([
        {
            title: { en: "Patient Demographics", ru: "Информация о пациенте" },
            icon: userSVG,
            alt: "user icon",
            subBlocks: [
                {
                    icon: userSVG,
                    alt: "user icon",
                    title: { en: "Patient Name", ru: "Имя пациента" },
                    comment: $dicomStore.patients?.[$currentPatientStore.currentPatientID]?.name ?? localePlaceholder
                },
                {
                    icon: hashtagSVG,
                    alt: "hashtag icon",
                    title: { en: "Patient Id", ru: "ID пациента" },
                    comment: $currentPatientStore.currentPatientID
                },
                {
                    icon: calendarSVG,
                    alt: "calendar icon",
                    title: { en: "Date of Birth", ru: "Дата рождения" },
                    comment: parseDicomDate($dicomStore.patients?.[$currentPatientStore.currentPatientID]?.birthDate) ?? localePlaceholder
                },
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { en: "Sex / Age", ru: "Пол / Возраст" },
                    comment: `${$dicomStore.patients?.[$currentPatientStore.currentPatientID]?.sex ?? localePlaceholder} • ${getPatientAge($dicomStore.patients?.[$currentPatientStore.currentPatientID]?.birthDate) ?? localePlaceholder}`
                }
            ]
        },
        {
            title: { en: "Study Information", ru: "Информация о исследовании" },
            icon: documentSVG,
            alt: "document icon",
            subBlocks: [
                {
                    icon: calendarSVG,
                    alt: "calendar icon",
                    title: { en: "Study Date", ru: "Дата проведения" },
                    comment: parseDicomDate($dicomStore.patients?.[$currentPatientStore.currentPatientID]?.studies[$currentPatientStore.currentStudyUID]?.studyDate) ?? localePlaceholder
                },
                {
                    icon: hashtagSVG,
                    alt: "hashtag icon",
                    title: { en: "Study Id", ru: "ID исследования" },
                    comment: $dicomStore.patients?.[$currentPatientStore.currentPatientID]?.studies[$currentPatientStore.currentStudyUID]?.studyInstanceUID ?? localePlaceholder
                },
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { en: "Description", ru: "Описание" },
                    comment: $dicomStore.patients?.[$currentPatientStore.currentPatientID]?.studies[$currentPatientStore.currentStudyUID]?.description ?? localePlaceholder
                },
                {
                    icon: userSVG,
                    alt: "user icon",
                    title: { en: "Physician Name", ru: "Имя лаборанта, проводившего исследование" },
                    comment: $dicomStore.patients?.[$currentPatientStore.currentPatientID]?.studies[$currentPatientStore.currentStudyUID]?.physicianName ?? localePlaceholder
                },
            ]
        },
        {
            title: { en: "Imaging Details", ru: "Информация о рентгенограммах" },
            icon: imageSVG,
            alt: "image icon",
            subBlocks: [
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { en: "Modality", ru: "Модальность" },
                    comment: $dicomStore.patients?.[$currentPatientStore.currentPatientID]?.studies[$currentPatientStore.currentStudyUID]?.series[$currentPatientStore.currentSeriesUID]?.modality ?? localePlaceholder
                },
                {
                    icon: userSVG,
                    alt: "user icon",
                    title: { en: "Body Part Examined", ru: "Исследуемая часть тела" },
                    comment: $dicomStore.patients?.[$currentPatientStore.currentPatientID]?.studies[$currentPatientStore.currentStudyUID]?.series[$currentPatientStore.currentSeriesUID]?.bodyPart ?? localePlaceholder
                },
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { en: "Available Views", ru: "Доступные для исследования проекции" },
                    comment: `${$sideProjectionExistsInStore ? "LATERAL": ""} / ${$frontalProjectionExistsInStore ? "FRONTAL": ""}`
                }
            ]
        },
        {
            title: { en: "Medical Facility", ru: "Место проведения исследований" },
            icon: facilitySVG,
            alt: "facility icon",
            subBlocks: [
                {
                    icon: facilitySVG,
                    alt: "facility icon",
                    title: { en: "Institution", ru: "Наименование заведения" },
                    comment: $dicomStore.patients?.[$currentPatientStore.currentPatientID]?.studies[$currentPatientStore.currentStudyUID]?.facility.institutionName ?? localePlaceholder
                },
                {
                    icon: facilitySVG,
                    alt: "facility icon",
                    title: { en: "Institution address", ru: "Адрес заведения" },
                    comment: $dicomStore.patients?.[$currentPatientStore.currentPatientID]?.studies[$currentPatientStore.currentStudyUID]?.facility.institutionAddress ?? localePlaceholder
                },
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { en: "Station Name", ru: "Наименование установки" },
                    comment: $dicomStore.patients?.[$currentPatientStore.currentPatientID]?.studies[$currentPatientStore.currentStudyUID]?.facility.stationName ?? localePlaceholder
                }
            ]
        }
    ]);
</script>

<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    {#each info as iblock}
        <div>
            <h3 class="font-semibold mb-4 flex items-center gap-2">
                <img src={ iblock.icon } alt={ iblock.alt } class="w-4 h-4"/>
                { iblock.title[$locale && $locale in iblock.title ? $locale: 'en'] }
            </h3>
            {#each iblock.subBlocks as info}
                <InfoBlock { info } />
            {/each}
        </div>
    {/each}
</div>