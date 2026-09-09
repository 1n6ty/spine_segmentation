import type { LocaleKey } from '$lib/core/i18n/types';
import { resolve_localized } from '$lib/core/i18n/resolve';
import { project } from '$lib/core/project.svelte';
import { get_age } from '$lib/shared/utils/date';

export interface ReportMeta {
	title: string;
	generatedAtLine: string;
	metaRows: [label: string, value: string][];
	disclaimer: string;
}

/**
 * Assembles the formal document's letterhead data from the current session's
 * merged patient / study / series metadata. Reads `project` directly (a
 * feature may depend on `core/` session state) and produces plain strings for
 * the passed locale — no reactive `$t`, so the doc-model builder stays
 * framework-agnostic.
 */
export function collectReportMeta(locale: LocaleKey): ReportMeta {
	const tr = (key: string, params?: Record<string, string | number>) =>
		resolve_localized(key, params)[locale];

	const nf = tr('not_found');
	const patient = project.session.mergedPatient;
	const study = project.session.mergedStudy;
	const series = project.session.mergedSeries;

	const fmtDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString(locale) : nf);
	const age = get_age(patient?.birthDate);

	const metaRows: [string, string][] = [
		[tr('report.meta.patient_name'), patient?.name || nf],
		[tr('report.meta.patient_id'), patient?.patientUID || nf],
		[tr('report.meta.dob'), fmtDate(patient?.birthDate)],
		[tr('report.meta.sex_age'), `${patient?.sex || nf} / ${age ?? nf}`],
		[tr('report.meta.study_date'), fmtDate(study?.studyDate)],
		[tr('report.meta.study_id'), study?.studyUID || nf],
		[tr('report.meta.description'), study?.description || nf],
		[tr('report.meta.physician'), study?.physicianName || nf],
		[tr('report.meta.modality'), series?.modality || nf],
		[tr('report.meta.body_part'), series?.bodyPart || nf],
		[tr('report.meta.institution'), study?.institutionName || nf],
		[tr('report.meta.address'), study?.institutionAddress || nf],
		[tr('report.meta.station'), study?.stationName || nf]
	];

	return {
		title: tr('report.header'),
		generatedAtLine: tr('report.generated_at', { datetime: new Date().toLocaleString(locale) }),
		metaRows,
		disclaimer: tr('report.disclaimer')
	};
}

/** Slug base for the downloaded file, e.g. `report_PID123_2026-09-09`. */
export function reportFilename(): string {
	const id =
		project.session.mergedPatient?.patientUID || project.session.mergedStudy?.studyUID || 'report';
	const safeId = id.replace(/[^\w.-]+/g, '_').slice(0, 60);
	return `report_${safeId}_${new Date().toISOString().slice(0, 10)}`;
}
