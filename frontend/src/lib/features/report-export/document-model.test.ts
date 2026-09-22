import { describe, expect, it } from 'vitest';
import { buildReportDocModel, type BuildReportOpts, type DocBlock } from './document-model';
import { abnormalNarrativeSentence } from '$lib/features/medical-parameters/diagnosis/narrative';
import { resolve_localized } from '$lib/core/i18n/resolve';
import type { LocaleKey, Localized } from '$lib/core/i18n/types';
import type {
	Finding,
	GapDiagnosis,
	ParametersNarrative,
	ProjectionDiagnosis,
	RegionDiagnosis,
	Severity,
	VertebraDiagnosis
} from '$lib/features/medical-parameters/diagnosis/types';

const L = (en: string, ru = en): Localized => ({ 'en-US': en, 'ru-RU': ru });

/** Mirrors the real diagnosis engine's own invariant (see
 * diagnosis-store.svelte.ts / narrative.ts's withClauseFinding): a
 * region/vertebra/gap's narrative clause severity always matches the
 * Finding it was graded from. `severity` defaults to `'normal'` — the
 * generic fallback clause a parameter gets when no grading rule flagged it
 * — matching a fixture with no abnormal findings. */
function narrative(identity: string, severity: Severity = 'normal'): ParametersNarrative {
	return {
		identity: L(identity),
		clauses: [{ key: 'p1', type: 'linear', text: L('Angle is 1°'), severity }]
	};
}

/** An abnormal Finding — the document model only ever renders a region/
 * vertebra/gap row when it has at least one of these. */
function finding(text: string, severity: Finding['severity'] = 'grade1'): Finding {
	return { id: 'f', severity, text: L(text) };
}

function vertebra(id: string, findings: Finding[] = []): VertebraDiagnosis {
	return {
		id,
		findings,
		narrative: narrative(`Vertebra ${id}`, findings[0]?.severity ?? 'normal')
	};
}

function gap(id: string, findings: Finding[] = []): GapDiagnosis {
	return { id, findings, narrative: narrative(`Disc ${id}`, findings[0]?.severity ?? 'normal') };
}

function region(over: Partial<RegionDiagnosis> = {}): RegionDiagnosis {
	const findings = over.findings ?? [];
	return {
		id: 'cervical',
		label: L('Cervical', 'Шейный отдел'),
		vertebraeLabel: 'C2-C3',
		vertebrae: [vertebra('C3'), vertebra('C2')], // stored inferior->superior
		gaps: [gap('C2-C3')],
		findings: [],
		narrative: narrative('Cervical region', findings[0]?.severity ?? 'normal'),
		...over
	};
}

function projection(over: Partial<ProjectionDiagnosis> = {}): ProjectionDiagnosis {
	return {
		insufficientAnnotation: false,
		regions: [region()],
		overall: [],
		conclusion: [],
		conclusionRanking: [],
		...over
	};
}

function opts(over: Partial<BuildReportOpts> = {}): BuildReportOpts {
	return {
		locale: 'en-US',
		title: 'Diagnostic Report',
		generatedAtLine: 'Generated: 2026-09-09',
		metaRows: [['Patient name', 'Jane Doe']],
		disclaimer: 'Auto-generated.',
		projections: [
			{ label: 'Lateral view', data: projection() },
			{ label: 'Frontal view', data: projection() }
		],
		...over
	};
}

const headingsAt = (model: DocBlock[], level: 1 | 2 | 3) =>
	model.filter(
		(b): b is Extract<DocBlock, { type: 'heading' }> => b.type === 'heading' && b.level === level
	);

describe('buildReportDocModel', () => {
	it('opens with title, generated line, meta table and a divider', () => {
		const model = buildReportDocModel(opts());
		expect(model.slice(0, 4)).toEqual([
			{ type: 'docTitle', text: 'Diagnostic Report' },
			{ type: 'paragraph', text: 'Generated: 2026-09-09' },
			{ type: 'metaTable', rows: [['Patient name', 'Jane Doe']] },
			{ type: 'divider' }
		]);
	});

	it('emits one L1 heading per projection with a page break before every one after the first', () => {
		const model = buildReportDocModel(opts());
		expect(headingsAt(model, 1).map((h) => h.text)).toEqual(['Lateral view', 'Frontal view']);

		const firstL1 = model.findIndex((b) => b.type === 'heading' && b.level === 1);
		const secondL1 = model.findIndex(
			(b, i) => i > firstL1 && b.type === 'heading' && b.level === 1
		);
		expect(model[firstL1 - 1]).not.toEqual({ type: 'pageBreak' });
		expect(model[secondL1 - 1]).toEqual({ type: 'pageBreak' });
	});

	it('omits a fully-normal region entirely from the export', () => {
		const model = buildReportDocModel(
			opts({ projections: [{ label: 'Lateral view', data: projection() }] })
		);
		expect(headingsAt(model, 2)).toHaveLength(0);
	});

	it('omits the Overall Assessment heading and bullets when nothing is abnormal', () => {
		const model = buildReportDocModel(
			opts({ projections: [{ label: 'Lateral view', data: projection() }] })
		);
		expect(model).not.toEqual(
			expect.arrayContaining([
				{ type: 'heading', level: 2, text: resolve_localized('report.header_overall')['en-US'] }
			])
		);
	});

	it('renders a region as an L2 heading (label + vertebra range) then its abnormal narrative sentence', () => {
		const model = buildReportDocModel(
			opts({
				projections: [
					{
						label: 'Lateral view',
						data: projection({ regions: [region({ findings: [finding('Region abnormal')] })] })
					}
				]
			})
		);
		const h2 = headingsAt(model, 2);
		expect(h2[0].text).toBe('Cervical (C2-C3)');

		const idx = model.indexOf(h2[0]);
		expect(model[idx + 1]).toEqual({
			type: 'paragraph',
			text: abnormalNarrativeSentence(narrative('Cervical region', 'grade1'))!['en-US']
		});
	});

	it('never includes a normal-severity clause in an emitted row, even on an otherwise-abnormal region', () => {
		// The region's own narrative carries both an abnormal clause and a
		// normal one (e.g. a parameter with no grading rule attached) — only
		// the abnormal clause's text may appear in the export.
		const mixedNarrative: ParametersNarrative = {
			identity: L('Cervical region'),
			clauses: [
				{ key: 'p1', type: 'linear', text: L('Angle is 1°'), severity: 'normal' },
				{ key: 'p3', type: 'angular', text: L('Kyphosis increased'), severity: 'grade2' }
			]
		};
		const model = buildReportDocModel(
			opts({
				projections: [
					{
						label: 'Lateral view',
						data: projection({
							regions: [
								region({ findings: [finding('Region abnormal')], narrative: mixedNarrative })
							]
						})
					}
				]
			})
		);
		const paras = model.filter((b) => b.type === 'paragraph').map((b) => b.text);
		expect(paras.some((t) => t.includes('Angle is 1°'))).toBe(false);
		expect(paras.some((t) => t.includes('Kyphosis increased'))).toBe(true);
	});

	it('appends an abnormal clause’s normal-range badge in parentheses, matching the report tab', () => {
		const rangedNarrative: ParametersNarrative = {
			identity: L('Cervical region'),
			clauses: [
				{
					key: 'p3',
					type: 'angular',
					text: L('Kyphosis increased'),
					severity: 'grade2',
					badge: L('normal 20 to 40°', 'норма от 20 до 40°')
				}
			]
		};
		const model = buildReportDocModel(
			opts({
				projections: [
					{
						label: 'Lateral view',
						data: projection({
							regions: [
								region({ findings: [finding('Region abnormal')], narrative: rangedNarrative })
							]
						})
					}
				]
			})
		);
		const paras = model.filter((b) => b.type === 'paragraph').map((b) => b.text);
		expect(paras.some((t) => t.includes('Kyphosis increased (normal 20 to 40°)'))).toBe(true);
	});

	it('interleaves vertebra and disc narratives top-to-bottom', () => {
		const abnormalRegion = region({
			vertebrae: [
				vertebra('C3', [finding('C3 abnormal')]),
				vertebra('C2', [finding('C2 abnormal')])
			],
			gaps: [gap('C2-C3', [finding('Gap abnormal')])]
		});
		const model = buildReportDocModel(
			opts({
				projections: [{ label: 'Lateral view', data: projection({ regions: [abnormalRegion] }) }]
			})
		);
		const paras = model.filter((b) => b.type === 'paragraph').map((b) => b.text);
		const v2 = abnormalNarrativeSentence(narrative('Vertebra C2', 'grade1'))!['en-US'];
		const g23 = abnormalNarrativeSentence(narrative('Disc C2-C3', 'grade1'))!['en-US'];
		const v3 = abnormalNarrativeSentence(narrative('Vertebra C3', 'grade1'))!['en-US'];
		expect(paras).toEqual(expect.arrayContaining([v2, g23, v3]));
		// C2 (superior) before the C2-C3 disc before C3 (inferior)
		expect(paras.indexOf(v2)).toBeLessThan(paras.indexOf(g23));
		expect(paras.indexOf(g23)).toBeLessThan(paras.indexOf(v3));
	});

	it('renders sub-regions as L3 headings and skips the parent’s own vertebra rows', () => {
		const sub = region({
			id: 'thoracic-upper',
			label: L('Upper thoracic'),
			vertebraeLabel: 'Th1-Th2',
			vertebrae: [vertebra('Th2'), vertebra('Th1', [finding('Th1 abnormal')])],
			gaps: []
		});
		const parent = region({
			id: 'thoracic',
			label: L('Thoracic'),
			vertebraeLabel: 'Th1-Th12',
			vertebrae: [vertebra('Th12'), vertebra('Th1')],
			gaps: [gap('Th1-Th12')],
			subRegions: [sub]
		});
		const model = buildReportDocModel(
			opts({ projections: [{ label: 'Lateral view', data: projection({ regions: [parent] }) }] })
		);
		expect(headingsAt(model, 3).map((h) => h.text)).toEqual(['Upper thoracic (Th1-Th2)']);
		const paras = model.filter((b) => b.type === 'paragraph').map((b) => b.text);
		expect(paras).not.toContain(
			abnormalNarrativeSentence(narrative('Vertebra Th12', 'grade1'))?.['en-US']
		);
		expect(paras).toContain(
			abnormalNarrativeSentence(narrative('Vertebra Th1', 'grade1'))!['en-US']
		);
	});

	it('emits one terminal summary sentence naming every ranked diagnosis with its confidence, and no per-diagnosis symptom bullets', () => {
		const data = projection({
			conclusionRanking: [
				{
					key: 'bekhterev-cervical',
					label: L('Bekhterev’s disease — cervical'),
					probability: 0.732,
					symptoms: [{ text: L('Fusion of facet joints'), severity: 'grade2' }]
				},
				{
					key: 'scheuermann',
					label: L('Scheuermann-Mau disease'),
					probability: 0.6,
					symptoms: [{ text: L('Wedged vertebrae'), severity: 'grade1' }]
				}
			]
		});
		const model = buildReportDocModel(opts({ projections: [{ label: 'Lateral view', data }] }));
		const summary = model.find((b) => b.type === 'summarySentence');
		expect(summary).toBeDefined();
		expect(summary?.type === 'summarySentence' && summary.text).toContain(
			'Bekhterev’s disease — cervical with 73.2% confidence'
		);
		expect(summary?.type === 'summarySentence' && summary.text).toContain(
			'Scheuermann-Mau disease with 60.0% confidence'
		);
		expect(model).not.toEqual(
			expect.arrayContaining([{ type: 'bullet', text: 'Fusion of facet joints' }])
		);
		expect(model).not.toEqual(
			expect.arrayContaining([{ type: 'bullet', text: 'Wedged vertebrae' }])
		);
	});

	it('falls back to the no-anomalies line when nothing is ranked', () => {
		const model = buildReportDocModel(
			opts({ projections: [{ label: 'Lateral view', data: projection() }] })
		);
		expect(model).toEqual(
			expect.arrayContaining([
				{ type: 'paragraph', text: resolve_localized('report.no_anomalies')['en-US'] }
			])
		);
	});

	it('for an insufficiently annotated projection emits only the notice, no region headings', () => {
		const model = buildReportDocModel(
			opts({
				projections: [
					{ label: 'Lateral view', data: projection({ insufficientAnnotation: true, regions: [] }) }
				]
			})
		);
		expect(headingsAt(model, 2)).toHaveLength(0);
		expect(model).toEqual(
			expect.arrayContaining([
				{ type: 'paragraph', text: resolve_localized('report.insufficient_annotation')['en-US'] }
			])
		);
	});

	it('resolves shared strings and region labels in the requested locale', () => {
		const ru: LocaleKey = 'ru-RU';
		const data = projection({
			regions: [region({ findings: [finding('Region abnormal')] })],
			overall: [finding('Overall abnormal')]
		});
		const model = buildReportDocModel(
			opts({ locale: ru, projections: [{ label: 'Сагиттальная', data }] })
		);
		expect(headingsAt(model, 2)[0].text).toBe('Шейный отдел (C2-C3)');
		expect(model).toEqual(
			expect.arrayContaining([
				{ type: 'heading', level: 2, text: resolve_localized('report.header_overall')[ru] }
			])
		);
	});

	it('closes with a divider and the disclaimer', () => {
		const model = buildReportDocModel(opts());
		expect(model.slice(-2)).toEqual([
			{ type: 'divider' },
			{ type: 'disclaimer', text: 'Auto-generated.' }
		]);
	});
});
