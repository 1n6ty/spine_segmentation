import type { SegmentDefinition } from '$lib/features/medical-parameters/types';

const LEGACY_DEFAULT_RANGES: Record<string, { topId: string; bottomId: string }> = {
	cervical: { topId: 'C2', bottomId: 'C7' },
	thoracic: { topId: 'Th1', bottomId: 'Th12' },
	lumbar: { topId: 'L1', bottomId: 'S1' }
};

/**
 * Drops legacy entries that some pre-refactor `UserRecentStudies.side_segments`/
 * `frontal_segments` DB rows may still contain -- back when Default Regions were seeded
 * into this same persisted list (`id` literally `'cervical'|'thoracic'|'lumbar'`, via the
 * now-removed `DEFAULT_SEGMENT_DEFINITIONS`) and Computed Regions were saved alongside
 * user segments (`generated: true`, via the now-removed `generated-segments.ts`). Neither
 * kind belongs in this field any more -- it's purely user-defined segments now -- so both
 * are filtered out here, once, on load, rather than re-saved indefinitely.
 *
 * A genuine user-added segment can never collide with this: `add_segment` always assigns a
 * `crypto.randomUUID()` id, never one of the 3 literal legacy strings, and never sets
 * `generated`.
 */
export function sanitize_persisted_segments(raw: unknown[]): SegmentDefinition[] {
	return (raw as (SegmentDefinition & { generated?: boolean })[]).filter((s) => {
		if (s.generated === true) return false;
		const legacy = LEGACY_DEFAULT_RANGES[s.id];
		if (legacy && s.topId === legacy.topId && s.bottomId === legacy.bottomId) return false;
		return true;
	});
}
