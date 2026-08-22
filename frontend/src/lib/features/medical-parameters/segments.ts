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
