import type { GapDiagnosis, RegionDiagnosis, VertebraDiagnosis } from './types';

export type RowItem =
	| { kind: 'vertebra'; data: VertebraDiagnosis }
	| { kind: 'gap'; data: GapDiagnosis };

/**
 * Orders a region's vertebra rows top-to-bottom (e.g. cervical: C2…C7) and
 * interleaves the disc/gap row that sits between each consecutive pair.
 *
 * `region.vertebrae` is stored bottom-up (inferior→superior) because that
 * order feeds the calculators (their angle sign conventions assume it) and
 * must stay untouched there — so this reverses a copy, display-only.
 *
 * A gap not bounded by two of this region's own vertebrae — e.g. a thoracic
 * sub-region's boundary disc, which `diagnosis-store.svelte.ts` appends to the
 * end of the sub-region's `gaps` list — renders after the region's last (most
 * inferior) vertebra row instead.
 */
export function interleave(region: RegionDiagnosis): RowItem[] {
	const ordered = [...region.vertebrae].reverse();
	const gapById = new Map(region.gaps.map((g) => [g.id, g]));
	const rows: RowItem[] = [];
	const usedIds: string[] = [];
	for (let i = 0; i < ordered.length; i++) {
		rows.push({ kind: 'vertebra', data: ordered[i] });
		if (i + 1 < ordered.length) {
			const id = `${ordered[i].id}-${ordered[i + 1].id}`;
			const gap = gapById.get(id);
			if (gap) {
				rows.push({ kind: 'gap', data: gap });
				usedIds.push(id);
			}
		}
	}
	for (const g of region.gaps) if (!usedIds.includes(g.id)) rows.push({ kind: 'gap', data: g });
	return rows;
}
