<script lang="ts">
    import { locale, t } from "svelte-i18n";

    import documentSVG from "$lib/assets/icons/document.svg";
    import userSVG from "$lib/assets/icons/user.svg";
    import imageSVG from "$lib/assets/icons/image.svg";
    import facilitySVG from "$lib/assets/icons/facility.svg";
    import calendarSVG from "$lib/assets/icons/calendar.svg";
    import hashtagSVG from "$lib/assets/icons/hashtag.svg";

    import type { PatientInfoBlock } from "$lib/components/layout/PatientInfo/PatientInfo.type";

    import InfoBlock from "$lib/components/layout/PatientInfo/InfoBlock.svelte";
    import { getPatientAge } from "$lib/shared/utils/patient";
	import { project } from "$lib/core/project.svelte";
	import { supportedLocales } from "$lib/core/i18n/index.svelte";

    const dateTimeOptions = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    } as const;

    let info: PatientInfoBlock[] = $derived([
        {
            title: { 'en-US': "Patient Demographics", 'ru-RU': "Информация о пациенте" },
            icon: userSVG,
            alt: "user icon",
            subBlocks: [
                {
                    icon: userSVG,
                    alt: "user icon",
                    title: { 'en-US': "Patient Name", 'ru-RU': "Имя пациента" },
                    comment: project.session.mergedPatient?.name ?? $t('not_found')
                },
                {
                    icon: hashtagSVG,
                    alt: "hashtag icon",
                    title: { 'en-US': "Patient Id", 'ru-RU': "ID пациента" },
                    comment: project.session.mergedPatient?.patientUID ?? $t('not_found')
                },
                {
                    icon: calendarSVG,
                    alt: "calendar icon",
                    title: { 'en-US': "Date of Birth", 'ru-RU': "Дата рождения" },
                    comment: project.session.mergedPatient?.birthDate?.toLocaleDateString($locale || undefined, dateTimeOptions) ?? $t('not_found')
                },
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { 'en-US': "Sex / Age", 'ru-RU': "Пол / Возраст" },
                    comment: `${project.session.mergedPatient?.sex ?? $t('not_found')} • ${getPatientAge(project.session.mergedPatient?.birthDate) ?? $t('not_found')}`
                }
            ]
        },
        {
            title: { 'en-US': "Study Information", 'ru-RU': "Информация о исследовании" },
            icon: documentSVG,
            alt: "document icon",
            subBlocks: [
                {
                    icon: calendarSVG,
                    alt: "calendar icon",
                    title: { 'en-US': "Study Date", 'ru-RU': "Дата проведения" },
                    comment: project.session.mergedStudy?.studyDate?.toLocaleDateString($locale || undefined, dateTimeOptions) ?? $t('not_found')
                },
                {
                    icon: hashtagSVG,
                    alt: "hashtag icon",
                    title: { 'en-US': "Study Id", 'ru-RU': "ID исследования" },
                    comment: project.session.mergedStudy?.studyUID ?? $t('not_found')
                },
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { 'en-US': "Description", 'ru-RU': "Описание" },
                    comment: project.session.mergedStudy?.description ?? $t('not_found')
                },
                {
                    icon: userSVG,
                    alt: "user icon",
                    title: { 'en-US': "Physician Name", 'ru-RU': "Имя лаборанта, проводившего исследование" },
                    comment: project.session.mergedStudy?.physicianName ?? $t('not_found')
                },
            ]
        },
        {
            title: { 'en-US': "Imaging Details", 'ru-RU': "Информация о рентгенограммах" },
            icon: imageSVG,
            alt: "image icon",
            subBlocks: [
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { 'en-US': "Modality", 'ru-RU': "Модальность" },
                    comment: project.session.mergedSeries?.modality ?? $t('not_found')
                },
                {
                    icon: userSVG,
                    alt: "user icon",
                    title: { 'en-US': "Body Part Examined", 'ru-RU': "Исследуемая часть тела" },
                    comment: project.session.mergedSeries?.bodyPart ?? $t('not_found')
                },
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { 'en-US': "Available Views", 'ru-RU': "Доступные для исследования проекции" },
                    comment: `${project.session.projections.side.hash ? "LATERAL": ""} / ${project.session.projections.frontal.hash ? "FRONTAL": ""}`
                }
            ]
        },
        {
            title: { 'en-US': "Medical Facility", 'ru-RU': "Место проведения исследований" },
            icon: facilitySVG,
            alt: "facility icon",
            subBlocks: [
                {
                    icon: facilitySVG,
                    alt: "facility icon",
                    title: { 'en-US': "Institution", 'ru-RU': "Наименование заведения" },
                    comment: project.session.mergedStudy?.institutionName ?? $t('not_found')
                },
                {
                    icon: facilitySVG,
                    alt: "facility icon",
                    title: { 'en-US': "Institution address", 'ru-RU': "Адрес заведения" },
                    comment: project.session.mergedStudy?.institutionAddress ?? $t('not_found')
                },
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { 'en-US': "Station Name", 'ru-RU': "Наименование установки" },
                    comment: project.session.mergedStudy?.stationName ?? $t('not_found')
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
                { iblock.title[$locale as typeof supportedLocales[number]] }
            </h3>
            {#each iblock.subBlocks as info}
                <InfoBlock { info } />
            {/each}
        </div>
    {/each}
</div>