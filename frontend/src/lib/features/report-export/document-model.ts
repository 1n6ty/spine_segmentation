import type { LocaleKey } from '$lib/core/i18n/types';
import { resolve_localized } from '$lib/core/i18n/resolve';
import { abnormalNarrativeSentence } from '$lib/features/medical-parameters/diagnosis/narrative';
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
	| { type: 'bullet'; text: string }
	| { type: 'divider' }
	| { type: 'pageBreak' }
	| { type: 'summarySentence'; text: string }
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
	const tr = (key: string, params?: Record<string, string | number>) =>
		resolve_localized(key, params)[locale];
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

		const abnormalOverall = proj.data.overall.filter((f) => f.severity !== 'normal');
		if (abnormalOverall.length > 0) {
			blocks.push({ type: 'divider' });
			blocks.push({ type: 'heading', level: 2, text: tr('report.header_overall') });
			for (const finding of abnormalOverall) {
				blocks.push({ type: 'bullet', text: finding.text[locale] });
			}
		}

		blocks.push({ type: 'divider' });
		if (proj.data.conclusionRanking.length === 0) {
			blocks.push({ type: 'paragraph', text: tr('report.no_anomalies') });
		} else {
			// Export-only: one terminal sentence naming every ranked diagnosis with
			// its confidence, no per-diagnosis parameter/symptom detail (that stays
			// on-screen only, in the still-unfiltered report tab) — per the user's
			// own requested phrasing.
			const items = proj.data.conclusionRanking
				.map((d) =>
					tr('report.summary_item', {
						label: d.label[locale],
						pct: (d.probability * 100).toFixed(1)
					})
				)
				.join(', ');
			blocks.push({ type: 'summarySentence', text: `${tr('report.summary_prefix')} ${items}.` });
		}
	});

	blocks.push({ type: 'divider' });
	blocks.push({ type: 'disclaimer', text: opts.disclaimer });

	return blocks;
}

/** True if this region itself, or any of its vertebrae/gaps/sub-regions
 * (recursively), has at least one non-normal finding — export-only gate so a
 * fully-normal region/vertebra/gap is omitted entirely rather than narrated. */
function regionHasAbnormalFinding(region: RegionDiagnosis): boolean {
	if (region.findings.some((f) => f.severity !== 'normal')) return true;
	if (region.vertebrae.some((v) => v.findings.some((f) => f.severity !== 'normal'))) return true;
	if (region.gaps.some((g) => g.findings.some((f) => f.severity !== 'normal'))) return true;
	return (region.subRegions ?? []).some(regionHasAbnormalFinding);
}

/**
 * A region → its L2/L3 heading + narrative paragraph, then either its clinical
 * sub-regions (sagittal thoracic only, one level deep by contract) or its
 * interleaved vertebra/disc narratives. Export-only: skips the region
 * entirely when nothing under it is abnormal, and — per the export's
 * abnormal-only content policy — renders each paragraph from only its
 * non-normal clauses (`abnormalNarrativeSentence`), never the full
 * per-parameter sentence `narrativeSentence` builds for the on-screen report
 * tab, so a normal finding is never stated even inline within an otherwise-
 * abnormal row's sentence.
 */
function emitRegion(
	blocks: DocBlock[],
	region: RegionDiagnosis,
	locale: LocaleKey,
	level: 2 | 3
): void {
	if (!regionHasAbnormalFinding(region)) return;

	blocks.push({
		type: 'heading',
		level,
		text: `${region.label[locale]} (${region.vertebraeLabel})`
	});
	const regionSentence = abnormalNarrativeSentence(region.narrative);
	if (regionSentence) {
		blocks.push({ type: 'paragraph', text: regionSentence[locale] });
	}

	if (region.subRegions?.length) {
		for (const sub of region.subRegions) emitRegion(blocks, sub, locale, 3);
		return;
	}

	for (const row of interleave(region)) {
		const sentence = abnormalNarrativeSentence(row.data.narrative);
		if (!sentence) continue;
		blocks.push({ type: 'paragraph', text: sentence[locale] });
	}
}
