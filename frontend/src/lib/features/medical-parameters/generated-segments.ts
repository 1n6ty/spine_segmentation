import { project } from '$lib/core/project.svelte';
import type { Projection } from '$lib/features/dicom/types';
import {
	computeGeneratedVertebraRanges,
	type GeneratedVertebraRange
} from '$lib/shared/anatomy/central-arc-segments';
import type { SegmentDefinition } from './types';

function to_segment_definition(range: GeneratedVertebraRange): SegmentDefinition {
	return {
		id: `generated:${range.bottomId}-${range.topId}`,
		topId: range.topId,
		bottomId: range.bottomId,
		generated: true
	};
}

function same_id_set(a: SegmentDefinition[], b: SegmentDefinition[]): boolean {
	if (a.length !== b.length) return false;
	const ids = new Set(a.map((s) => s.id));
	return b.every((s) => ids.has(s.id));
}

/**
 * Recomputes `projection`'s auto-detected arc segments from its current polygons and, if the
 * result differs from what's currently stored, replaces the `generated`-tagged subset of
 * `slot.segments` and persists -- same mutate-then-`requestSave()` idiom as `add_segment`/
 * `remove_segment` in `segments.ts`. User-managed (non-`generated`) segments are left untouched.
 *
 * A candidate range that exactly matches an existing user-managed segment is skipped -- the
 * user's manual entry already covers it, and adding a `generated:` twin would just show the
 * same range as two rows (this is `add_segment`'s replace-the-generated-one behavior, mirrored
 * from the other direction).
 *
 * The id-set comparison (rather than always overwriting) avoids an unconditional save loop if
 * called from a reactive `$effect` on every polygon read.
 */
export function sync_generated_segments(projection: Projection): void {
	const slot = project.session.projections[projection];
	const manual = slot.segments.filter((s) => !s.generated);
	const manualRanges = new Set(manual.map((s) => `${s.topId}:${s.bottomId}`));

	const next = computeGeneratedVertebraRanges(slot.polygons)
		.filter((range) => !manualRanges.has(`${range.topId}:${range.bottomId}`))
		.map(to_segment_definition);
	const current = slot.segments.filter((s) => s.generated);

	if (same_id_set(current, next)) return;

	slot.segments = [...manual, ...next];
	project.session.requestSave();
}
