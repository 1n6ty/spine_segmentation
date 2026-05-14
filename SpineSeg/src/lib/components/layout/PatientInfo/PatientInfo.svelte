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
	import type { PatientService } from "$lib/core/session/patient.svelte";
	import type { StudyService } from "$lib/core/session/study.svelte";
	import type { SeriesService } from "$lib/core/session/series.svelte";
	import { supportedLocales } from "$lib/core/i18n/index.svelte";

    const patient = $derived.by(() => {
        const services = Object.values(project.session.projections)
            .map(p => p.patient)
            .filter((s): s is PatientService => !!s);

        if (services.length === 0) return null;

        const fields = [
            'patientUID', 'name', 'birthDate', 'sex'
        ] as const;

        return services.reduce((acc, curr) => {
            const result = { ...acc };
            for (const field of fields) {
                result[field] = acc[field] || (curr as any)[field];
            }
            return result;
        }, {} as Record<string, any>);
    });

    const study = $derived.by(() => {
        const services = Object.values(project.session.projections)
            .map(p => p.patient?.study)
            .filter((s): s is StudyService => !!s);

        if (services.length === 0) return null;

        const fields = [
            'studyUID', 'studyDate', 'description', 'physicianName', 
            'institutionName', 'institutionAddress', 'stationName'
        ] as const;

        return services.reduce((acc, curr) => {
            const result = { ...acc };
            for (const field of fields) {
                result[field] = acc[field] || (curr as any)[field];
            }
            return result;
        }, {} as Record<string, any>);
    });

    const series = $derived.by(() => {
        const services = Object.values(project.session.projections)
            .map(p => p.patient?.study.series)
            .filter((s): s is SeriesService => !!s);

        if (services.length === 0) return null;

        const fields = [
            'seriesUID', 'modality', 'bodyPart'
        ] as const;

        return services.reduce((acc, curr) => {
            const result = { ...acc };
            for (const field of fields) {
                result[field] = acc[field] || (curr as any)[field];
            }
            return result;
        }, {} as Record<string, any>);
    });

    const dateTimeOptions = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    };

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
                    comment: patient?.name ?? $t('not_found')
                },
                {
                    icon: hashtagSVG,
                    alt: "hashtag icon",
                    title: { 'en-US': "Patient Id", 'ru-RU': "ID пациента" },
                    comment: patient?.patientUID
                },
                {
                    icon: calendarSVG,
                    alt: "calendar icon",
                    title: { 'en-US': "Date of Birth", 'ru-RU': "Дата рождения" },
                    comment: patient?.birthDate.toLocaleDateString($locale, dateTimeOptions) ?? $t('not_found')
                },
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { 'en-US': "Sex / Age", 'ru-RU': "Пол / Возраст" },
                    comment: `${patient?.sex ?? $t('not_found')} • ${getPatientAge(patient?.birthDate) ?? $t('not_found')}`
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
                    comment: study?.studyDate.toLocaleDateString($locale, dateTimeOptions) ?? $t('not_found')
                },
                {
                    icon: hashtagSVG,
                    alt: "hashtag icon",
                    title: { 'en-US': "Study Id", 'ru-RU': "ID исследования" },
                    comment: study?.studyUID ?? $t('not_found')
                },
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { 'en-US': "Description", 'ru-RU': "Описание" },
                    comment: study?.description ?? $t('not_found')
                },
                {
                    icon: userSVG,
                    alt: "user icon",
                    title: { 'en-US': "Physician Name", 'ru-RU': "Имя лаборанта, проводившего исследование" },
                    comment: study?.physicianName ?? $t('not_found')
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
                    comment: series?.modality ?? $t('not_found')
                },
                {
                    icon: userSVG,
                    alt: "user icon",
                    title: { 'en-US': "Body Part Examined", 'ru-RU': "Исследуемая часть тела" },
                    comment: series?.bodyPart ?? $t('not_found')
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
                    comment: study?.institutionName ?? $t('not_found')
                },
                {
                    icon: facilitySVG,
                    alt: "facility icon",
                    title: { 'en-US': "Institution address", 'ru-RU': "Адрес заведения" },
                    comment: study?.institutionAddress ?? $t('not_found')
                },
                {
                    icon: documentSVG,
                    alt: "document icon",
                    title: { 'en-US': "Station Name", 'ru-RU': "Наименование установки" },
                    comment: study?.stationName ?? $t('not_found')
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