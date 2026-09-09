import type { LocaleKey } from '$lib/core/i18n/types';
import { resolve_localized } from '$lib/core/i18n/resolve';
import { narrativeSentence } from '$lib/features/medical-parameters/diagnosis/narrative';
import { interleave } from '$lib/features/medical-parameters/diagnosis/interleave';
import type {
	ProjectionDiagnosis,
	RegionDiagnosis
} from '$lib/features/medical-parameters/diagnosis/types';

/**
 * The renderer-agnostic representation of the formal report document. Both the
 * PDF (pdfmake) and DOCX (docx) renderers walk this flat block list; nothing
 * here touches the DOM, a document library, or svelte-i18n's reactive `$t`.
 */
export type DocBlock =
	| { type: 'docTitle'; text: string }
	| { type: 'metaTable'; rows: [label: string, value: string][] }
	| { type: 'heading'; level: 1 | 2 | 3; text: string }
	| { type: 'paragraph'; text: string }
	| { type: 'rankedDiagnosis'; label: string; probabilityPct: string }
	| { type: 'bullet'; text: string }
	| { type: 'divider' }
	| { type: 'pageBreak' }
	| { type: 'disclaimer'; text: string };

export interface ReportProjectionInput {
	/** Localized projection name, e.g. "Lateral view" / "Сагиттальная проекция". */
	label: string;
	data: ProjectionDiagnosis;
}

export interface BuildReportOpts {
	locale: LocaleKey;
	/** Document title, e.g. resolve_localized('report.header')[locale]. */
	title: string;
	/** Pre-formatted "Generated: <datetime>" line. */
	generatedAtLine: string;
	/** Patient / study / facility rows for the letterhead table. */
	metaRows: [label: string, value: string][];
	/** Emitted in order; a page break is inserted before every entry after the first. */
	projections: ReportProjectionInput[];
	disclaimer: string;
}

export function buildReportDocModel(opts: BuildReportOpts): DocBlock[] {
	const { locale } = opts;
	const tr = (key: string) => resolve_localized(key)[locale];
	const blocks: DocBlock[] = [];

	blocks.push({ type: 'docTitle', text: opts.title });
	blocks.push({ type: 'paragraph', text: opts.generatedAtLine });
	blocks.push({ type: 'metaTable', rows: opts.metaRows });
	blocks.push({ type: 'divider' });

	opts.projections.forEach((proj, i) => {
		if (i > 0) blocks.push({ type: 'pageBreak' });
		blocks.push({ type: 'heading', level: 1, text: proj.label });

		if (proj.data.insufficientAnnotation) {
			blocks.push({ type: 'paragraph', text: tr('report.insufficient_annotation') });
			return;
		}

		for (const region of proj.data.regions) emitRegion(blocks, region, locale, 2);

		blocks.push({ type: 'divider' });
		blocks.push({ type: 'heading', level: 2, text: tr('report.header_overall') });

		for (const finding of proj.data.overall) {
			blocks.push({ type: 'bullet', text: finding.text[locale] });
		}

		if (proj.data.conclusionRanking.length === 0) {
			blocks.push({ type: 'paragraph', text: tr('report.no_anomalies') });
		} else {
			for (const d of proj.data.conclusionRanking) {
				blocks.push({
					type: 'rankedDiagnosis',
					label: d.label[locale],
					probabilityPct: (d.probability * 100).toFixed(1)
				});
				for (const symptom of d.symptoms) {
					blocks.push({ type: 'bullet', text: symptom.text[locale] });
				}
			}
		}
	});

	blocks.push({ type: 'divider' });
	blocks.push({ type: 'disclaimer', text: opts.disclaimer });

	return blocks;
}

/**
 * A region → its L2/L3 heading + narrative paragraph, then either its clinical
 * sub-regions (sagittal thoracic only, one level deep by contract) or its
 * interleaved vertebra/disc narratives.
 */
function emitRegion(
	blocks: DocBlock[],
	region: RegionDiagnosis,
	locale: LocaleKey,
	level: 2 | 3
): void {
	blocks.push({
		type: 'heading',
		level,
		text: `${region.label[locale]} (${region.vertebraeLabel})`
	});
	blocks.push({ type: 'paragraph', text: narrativeSentence(region.narrative)[locale] });

	if (region.subRegions?.length) {
		for (const sub of region.subRegions) emitRegion(blocks, sub, locale, 3);
		return;
	}

	for (const row of interleave(region)) {
		blocks.push({ type: 'paragraph', text: narrativeSentence(row.data.narrative)[locale] });
	}
}
