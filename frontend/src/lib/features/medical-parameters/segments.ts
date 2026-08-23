import { project } from '$lib/core/project.svelte';
import type { Projection } from '$lib/features/dicom/types';

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
 *
 * If an auto-detected (`generated: true`) segment already covers this exact same range, it's
 * dropped in favor of the new manual one rather than left alongside it -- otherwise the table
 * would show the same vertebra range twice (once generated, once manual) until the next
 * `sync_generated_segments` recompute, which wouldn't even remove the duplicate, since the
 * range is still one it would generate.
 */
export function add_segment(projection: Projection, topId: string, bottomId: string): void {
	const slot = project.session.projections[projection];
	const withoutMatchingGenerated = slot.segments.filter(
		(s) => !(s.generated && s.topId === topId && s.bottomId === bottomId)
	);
	slot.segments = [...withoutMatchingGenerated, { id: crypto.randomUUID(), topId, bottomId }];
	project.session.requestSave();
}

/**
 * Whether `projection` has enough annotated vertebrae (>=2) to pick a range spanning at least
 * two of them -- i.e. whether the range-picker modal has anything meaningful to show. Backs the
 * "+" add-segment button's disabled state. Checked directly against `polygons.length` rather
 * than `computeCentralPath(...) !== null`: since `computeCentralPath` now includes every
 * vertebra's own bottom/top plate (see its doc comment), it returns a usable (if trivial) path
 * even for a single vertebra, so it's no longer a valid proxy for "at least 2 vertebrae".
 */
export function can_add_segment(projection: Projection): boolean {
	return project.session.projections[projection].polygons.length >= 2;
}
