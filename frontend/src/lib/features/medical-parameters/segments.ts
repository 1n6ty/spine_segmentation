import { project } from '$lib/core/project.svelte';
import type { Projection } from '$lib/features/dicom/types';
import { computeCentralPath } from '$lib/shared/anatomy/central-path';

/**
 * Removes one segment definition from a projection's list and persists the change --
 * mirrors the mutate-then-`requestSave()` idiom `editor/core/controllers/tool.svelte.ts`
 * already uses for polygon deletion (there's no dedicated add/delete method on
 * SessionService; callers mutate the `$state` array directly).
 */
export function remove_segment(projection: Projection, id: string): void {
	const slot = project.session.projections[projection];
	slot.segments = slot.segments.filter((s) => s.id !== id);
	project.session.requestSave();
}

/**
 * Appends a new segment definition and persists the change -- same mutate-then-
 * requestSave() idiom as `remove_segment`. `crypto.randomUUID()` matches this codebase's
 * existing id-generation convention (`editor/core/controllers/tool.svelte.ts`,
 * `autofill/ref-points.ts`).
 */
export function add_segment(projection: Projection, topId: string, bottomId: string): void {
	const slot = project.session.projections[projection];
	slot.segments = [...slot.segments, { id: crypto.randomUUID(), topId, bottomId }];
	project.session.requestSave();
}

/**
 * Whether `projection` has enough annotated vertebrae (>=2) for `computeCentralPath` to
 * return a usable path -- i.e. whether the range-picker modal has anything to show. Backs
 * the "+" add-segment button's disabled state, sharing the exact same null-check
 * `SegmentRangePicker`'s own `centralPath` derivation relies on, so the two can never
 * disagree about whether there's "enough" data.
 */
export function can_add_segment(projection: Projection): boolean {
	return computeCentralPath(project.session.projections[projection].polygons) !== null;
}
