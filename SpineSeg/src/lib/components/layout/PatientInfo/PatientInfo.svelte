<script lang="ts">
    import { locale, t } from "svelte-i18n";

    import { currentPatientStore } from "$lib/stores/patient/patient.store";
    import { dicomRegistryStore, dicomSidePixelDataStore, dicomFrontalPixelDataStore } from "$lib/stores/dicom/dicom.store";

    import documentSVG from "$lib/assets/icons/document.svg";
    import userSVG from "$lib/assets/icons/user.svg";
    import imageSVG from "$lib/assets/icons/image.svg";
    import facilitySVG from "$lib/assets/icons/facility.svg";
    import calendarSVG from "$lib/assets/icons/calendar.svg";
    import hashtagSVG from "$lib/assets/icons/hashtag.svg";

    import type { PatientInfoBlock } from "$lib/components/layout/PatientInfo/PatientInfo.type";

    import InfoBlock from "$lib/components/layout/PatientInfo/InfoBlock.svelte";
	import { parseDicomDate } from "$lib/utils/dicom";
    import { getPatientAge } from "$lib/utils/patient";

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
                    comment: $dicomRegistryStore.patients?.[$currentPatientStore.patientID]?.name ?? $t('not_found')
                },
                {
                    icon: hashtagSVG,
                    alt: "hashtag icon",
                    title: { en: "Patient Id", ru: "ID пациента" },
                    comment: $currentPatientStore.patientID
                },
                {
                    icon: calendarSVG,
                    alt: "calendar icon",
                    title: { en: "Date of Birth", ru: "Дата рождения" },
                    comment: parseDicomDate($dicomRegistryStore.patients?.[$currentPatientStore.patientID]?.birthDate) ?? $t('not_found')
                },
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { en: "Sex / Age", ru: "Пол / Возраст" },
                    comment: `${$dicomRegistryStore.patients?.[$currentPatientStore.patientID]?.sex ?? $t('not_found')} • ${getPatientAge($dicomRegistryStore.patients?.[$currentPatientStore.patientID]?.birthDate) ?? $t('not_found')}`
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
                    comment: parseDicomDate($dicomRegistryStore.patients?.[$currentPatientStore.patientID]?.studies[$currentPatientStore.studyUID]?.studyDate) ?? $t('not_found')
                },
                {
                    icon: hashtagSVG,
                    alt: "hashtag icon",
                    title: { en: "Study Id", ru: "ID исследования" },
                    comment: $dicomRegistryStore.patients?.[$currentPatientStore.patientID]?.studies[$currentPatientStore.studyUID]?.studyInstanceUID ?? $t('not_found')
                },
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { en: "Description", ru: "Описание" },
                    comment: $dicomRegistryStore.patients?.[$currentPatientStore.patientID]?.studies[$currentPatientStore.studyUID]?.description ?? $t('not_found')
                },
                {
                    icon: userSVG,
                    alt: "user icon",
                    title: { en: "Physician Name", ru: "Имя лаборанта, проводившего исследование" },
                    comment: $dicomRegistryStore.patients?.[$currentPatientStore.patientID]?.studies[$currentPatientStore.studyUID]?.physicianName ?? $t('not_found')
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
                    comment: $dicomRegistryStore.patients?.[$currentPatientStore.patientID]?.studies[$currentPatientStore.studyUID]?.series[$currentPatientStore.seriesUID]?.modality ?? $t('not_found')
                },
                {
                    icon: userSVG,
                    alt: "user icon",
                    title: { en: "Body Part Examined", ru: "Исследуемая часть тела" },
                    comment: $dicomRegistryStore.patients?.[$currentPatientStore.patientID]?.studies[$currentPatientStore.studyUID]?.series[$currentPatientStore.seriesUID]?.bodyPart ?? $t('not_found')
                },
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { en: "Available Views", ru: "Доступные для исследования проекции" },
                    comment: `${$dicomSidePixelDataStore ? "LATERAL": ""} / ${$dicomFrontalPixelDataStore ? "FRONTAL": ""}`
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
                    comment: $dicomRegistryStore.patients?.[$currentPatientStore.patientID]?.studies[$currentPatientStore.studyUID]?.facility.institutionName ?? $t('not_found')
                },
                {
                    icon: facilitySVG,
                    alt: "facility icon",
                    title: { en: "Institution address", ru: "Адрес заведения" },
                    comment: $dicomRegistryStore.patients?.[$currentPatientStore.patientID]?.studies[$currentPatientStore.studyUID]?.facility.institutionAddress ?? $t('not_found')
                },
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { en: "Station Name", ru: "Наименование установки" },
                    comment: $dicomRegistryStore.patients?.[$currentPatientStore.patientID]?.studies[$currentPatientStore.studyUID]?.facility.stationName ?? $t('not_found')
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