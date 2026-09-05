import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import {
	BOTTOM_SIDE_INDICES,
	LEFT_SIDE_INDICES,
	RIGHT_SIDE_INDICES,
	TOP_SIDE_INDICES
} from '../logic/orderer';

export type Side = 'left' | 'right' | 'top' | 'bottom';

/** Every side's corner-index pair -- the one place this mapping lives besides `orderer.ts`
 * itself, shared by `pointKeysOf` here and the hit-testing/rendering/rect-classification code
 * that also needs "given a side, which two points does it cover." */
export const SIDE_INDICES: Record<Side, readonly [number, number]> = {
	left: LEFT_SIDE_INDICES,
	right: RIGHT_SIDE_INDICES,
	top: TOP_SIDE_INDICES,
	bottom: BOTTOM_SIDE_INDICES
};

/**
 * A single selectable thing in the editor, at one of three granularities. `polygonUuid` always
 * identifies the owning vertebra; `side`/`pointIndex` narrow it further. There is no per-point
 * identity in the underlying data model (`Polygon.points` is a plain 4-element array) -- a point
 * is addressed by its index, which is stable within a gesture because `orderAndName`'s corner
 * convention (`orderer.ts`'s `LEFT_SIDE_INDICES`/`RIGHT_SIDE_INDICES`/`TOP_SIDE_INDICES`/
 * `BOTTOM_SIDE_INDICES`) only re-runs on drag/nudge finalization, never mid-gesture.
 */
export type SelectionEntry =
	| { kind: 'vertebra'; polygonUuid: string }
	| { kind: 'side'; polygonUuid: string; side: Side }
	| { kind: 'point'; polygonUuid: string; pointIndex: number };

/** Stable string key for Set/Map membership and equality checks. */
export function selectionEntryKey(entry: SelectionEntry): string {
	switch (entry.kind) {
		case 'vertebra':
			return `vertebra:${entry.polygonUuid}`;
		case 'side':
			return `side:${entry.polygonUuid}:${entry.side}`;
		case 'point':
			return `point:${entry.polygonUuid}:${entry.pointIndex}`;
	}
}

/**
 * Expands a mix of vertebra/side/point entries into the concrete `{polygonUuid, pointIndex}`
 * pairs they cover, deduplicated -- the single place the vertebra/side -> point-index expansion
 * happens, shared by rendering, group-drag, and arrow-key nudge.
 */
export function pointKeysOf(
	entries: Iterable<SelectionEntry>
): { polygonUuid: string; pointIndex: number }[] {
	const seen = new SvelteSet<string>();
	const result: { polygonUuid: string; pointIndex: number }[] = [];

	const add = (polygonUuid: string, pointIndex: number) => {
		const key = `${polygonUuid}:${pointIndex}`;
		if (seen.has(key)) return;
		seen.add(key);
		result.push({ polygonUuid, pointIndex });
	};

	for (const entry of entries) {
		if (entry.kind === 'vertebra') {
			for (let i = 0; i < 4; i++) add(entry.polygonUuid, i);
		} else if (entry.kind === 'side') {
			for (const i of SIDE_INDICES[entry.side]) add(entry.polygonUuid, i);
		} else {
			add(entry.polygonUuid, entry.pointIndex);
		}
	}

	return result;
}

/**
 * Multi-selection state for the editor's vertebra/side/point granularity. Polygon-concrete (not
 * generic like the old `SelectionState<TEntity>` it replaces) -- side/point addressing is
 * inherently tied to the 4-point, left=[0,1]/right=[2,3] vertebra shape `orderer.ts` enforces,
 * so there's no meaningful generic version of this any more, and there's exactly one call site
 * (`ToolController`) anyway.
 */
export class PolygonSelectionState {
	private entries = new SvelteMap<string, SelectionEntry>();

	/**
	 * The Shift+Click/Shift+rect range anchor -- the last plain-selected item. Ctrl/Cmd+click
	 * toggles and box-select never move it, so repeated Shift+selections keep measuring from the
	 * same fixed starting point (file-explorer/spreadsheet convention), not from the last
	 * endpoint.
	 */
	anchor = $state<SelectionEntry | null>(null);

	readonly size = $derived(this.entries.size);
	readonly isEmpty = $derived(this.entries.size === 0);

	has(entry: SelectionEntry): boolean {
		return this.entries.has(selectionEntryKey(entry));
	}

	/** True iff the current selection is exactly this one entry -- backs the "click again on the
	 * sole-selected thing to deselect it" rule. */
	isSoleSelection(entry: SelectionEntry): boolean {
		return this.entries.size === 1 && this.has(entry);
	}

	/** Every currently selected entry, in insertion order. Used by rendering and group-drag. */
	get all(): SelectionEntry[] {
		return [...this.entries.values()];
	}

	/** Plain click: replace the selection with just this item and move the anchor to it. */
	selectOnly(entry: SelectionEntry): void {
		this.entries.clear();
		this.entries.set(selectionEntryKey(entry), entry);
		this.anchor = entry;
	}

	/** Ctrl/Cmd+click: add/remove this item without touching the anchor, agnostic of its
	 * granularity -- a mixed selection (one whole vertebra + one side + one lone point) is
	 * valid. */
	toggleOne(entry: SelectionEntry): void {
		const key = selectionEntryKey(entry);
		if (this.entries.has(key)) {
			this.entries.delete(key);
		} else {
			this.entries.set(key, entry);
		}
	}

	toggleMany(entries: SelectionEntry[]): void {
		for (const entry of entries) this.toggleOne(entry);
	}

	/** Box-select (non-additive): replace the selection with exactly these entries. */
	replaceWithMany(entries: SelectionEntry[]): void {
		this.entries.clear();
		for (const entry of entries) this.entries.set(selectionEntryKey(entry), entry);
	}

	private selectPointsForVertebraRange(
		orderedUuids: string[],
		fromIdx: number,
		toIdx: number
	): void {
		const [from, to] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
		const entries: SelectionEntry[] = [];
		for (const polygonUuid of orderedUuids.slice(from, to + 1)) {
			for (let pointIndex = 0; pointIndex < 4; pointIndex++) {
				entries.push({ kind: 'point', polygonUuid, pointIndex });
			}
		}
		this.replaceWithMany(entries);
	}

	/**
	 * Shift+click: resolves to "that vertebra" for range purposes regardless of exactly where
	 * within it `targetEntry` was hit (side/body/point all count). Expands to every corner point
	 * (4 per vertebra, canonical order) of every vertebra in the inclusive range between the
	 * anchor's vertebra and the target's, per `orderedUuids`. Falls back to `selectOnly` if
	 * there's no anchor, or the anchor's vertebra is no longer present. Anchor is not moved.
	 */
	selectPointRangeByVertebra(orderedUuids: string[], targetEntry: SelectionEntry): void {
		if (this.anchor === null) {
			this.selectOnly(targetEntry);
			return;
		}

		const anchorIdx = orderedUuids.indexOf(this.anchor.polygonUuid);
		const targetIdx = orderedUuids.indexOf(targetEntry.polygonUuid);
		if (anchorIdx === -1 || targetIdx === -1) {
			this.selectOnly(targetEntry);
			return;
		}

		this.selectPointsForVertebraRange(orderedUuids, anchorIdx, targetIdx);
	}

	/**
	 * Shift+rectangle: same point-range semantics as `selectPointRangeByVertebra`, seeded from
	 * the union of vertebrae the rectangle touches (`touchedVertebraUuids`) instead of a single
	 * clicked vertebra -- the range spans from the anchor to whichever touched vertebra is
	 * farthest in either direction. Falls back to a plain replace with `fallbackEntries` (the
	 * rectangle's own per-entity classification, unexpanded) if there's no anchor.
	 */
	selectPointRangeOverVertebraSet(
		orderedUuids: string[],
		touchedVertebraUuids: Iterable<string>,
		fallbackEntries: SelectionEntry[]
	): void {
		if (this.anchor === null) {
			this.replaceWithMany(fallbackEntries);
			return;
		}

		const anchorIdx = orderedUuids.indexOf(this.anchor.polygonUuid);
		const touchedIndices = [...touchedVertebraUuids]
			.map((uuid) => orderedUuids.indexOf(uuid))
			.filter((i) => i !== -1);

		if (anchorIdx === -1 || touchedIndices.length === 0) {
			this.replaceWithMany(fallbackEntries);
			return;
		}

		const from = Math.min(anchorIdx, ...touchedIndices);
		const to = Math.max(anchorIdx, ...touchedIndices);
		this.selectPointsForVertebraRange(orderedUuids, from, to);
	}

	clear(): void {
		this.entries.clear();
		this.anchor = null;
	}
}
