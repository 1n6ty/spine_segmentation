import { describe, expect, it } from 'vitest';
import { buildReportDocModel, type BuildReportOpts, type DocBlock } from './document-model';
import { narrativeSentence } from '$lib/features/medical-parameters/diagnosis/narrative';
import { resolve_localized } from '$lib/core/i18n/resolve';
import type { LocaleKey, Localized } from '$lib/core/i18n/types';
import type {
	GapDiagnosis,
	ParametersNarrative,
	ProjectionDiagnosis,
	RegionDiagnosis,
	VertebraDiagnosis
} from '$lib/features/medical-parameters/diagnosis/types';

const L = (en: string, ru = en): Localized => ({ 'en-US': en, 'ru-RU': ru });

function narrative(identity: string): ParametersNarrative {
	return {
		identity: L(identity),
		clauses: [{ key: 'p1', type: 'linear', text: L('Angle is 1°'), severity: 'normal' }]
	};
}

function vertebra(id: string): VertebraDiagnosis {
	return { id, findings: [], narrative: narrative(`Vertebra ${id}`) };
}

function gap(id: string): GapDiagnosis {
	return { id, findings: [], narrative: narrative(`Disc ${id}`) };
}

function region(over: Partial<RegionDiagnosis> = {}): RegionDiagnosis {
	return {
		id: 'cervical',
		label: L('Cervical', 'Шейный отдел'),
		vertebraeLabel: 'C2-C3',
		vertebrae: [vertebra('C3'), vertebra('C2')], // stored inferior->superior
		gaps: [gap('C2-C3')],
		findings: [],
		narrative: narrative('Cervical region'),
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

	it('renders a region as an L2 heading (label + vertebra range) then its narrative sentence', () => {
		const model = buildReportDocModel(
			opts({ projections: [{ label: 'Lateral view', data: projection() }] })
		);
		const h2 = headingsAt(model, 2);
		expect(h2[0].text).toBe('Cervical (C2-C3)');

		const idx = model.indexOf(h2[0]);
		expect(model[idx + 1]).toEqual({
			type: 'paragraph',
			text: narrativeSentence(narrative('Cervical region'))['en-US']
		});
	});

	it('interleaves vertebra and disc narratives top-to-bottom', () => {
		const model = buildReportDocModel(
			opts({ projections: [{ label: 'Lateral view', data: projection() }] })
		);
		const paras = model.filter((b) => b.type === 'paragraph').map((b) => b.text);
		expect(paras).toEqual(
			expect.arrayContaining([
				narrativeSentence(narrative('Vertebra C2'))['en-US'],
				narrativeSentence(narrative('Disc C2-C3'))['en-US'],
				narrativeSentence(narrative('Vertebra C3'))['en-US']
			])
		);
		// C2 (superior) before the C2-C3 disc before C3 (inferior)
		expect(paras.indexOf(narrativeSentence(narrative('Vertebra C2'))['en-US'])).toBeLessThan(
			paras.indexOf(narrativeSentence(narrative('Disc C2-C3'))['en-US'])
		);
		expect(paras.indexOf(narrativeSentence(narrative('Disc C2-C3'))['en-US'])).toBeLessThan(
			paras.indexOf(narrativeSentence(narrative('Vertebra C3'))['en-US'])
		);
	});

	it('renders sub-regions as L3 headings and skips the parent’s own vertebra rows', () => {
		const sub = region({
			id: 'thoracic-upper',
			label: L('Upper thoracic'),
			vertebraeLabel: 'Th1-Th2',
			vertebrae: [vertebra('Th2'), vertebra('Th1')],
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
		expect(paras).not.toContain(narrativeSentence(narrative('Vertebra Th12'))['en-US']);
		expect(paras).toContain(narrativeSentence(narrative('Vertebra Th1'))['en-US']);
	});

	it('lists ranked diagnoses with their symptoms as bullets', () => {
		const data = projection({
			conclusionRanking: [
				{
					key: 'bekhterev-cervical',
					label: L('Bekhterev’s disease — cervical'),
					probability: 0.732,
					symptoms: [{ text: L('Fusion of facet joints'), severity: 'grade2' }]
				}
			]
		});
		const model = buildReportDocModel(opts({ projections: [{ label: 'Lateral view', data }] }));
		expect(model).toEqual(
			expect.arrayContaining([
				{
					type: 'rankedDiagnosis',
					label: 'Bekhterev’s disease — cervical',
					probabilityPct: '73.2'
				},
				{ type: 'bullet', text: 'Fusion of facet joints' }
			])
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
		const model = buildReportDocModel(
			opts({ locale: ru, projections: [{ label: 'Сагиттальная', data: projection() }] })
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
