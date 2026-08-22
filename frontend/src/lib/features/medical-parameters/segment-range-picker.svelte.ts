import type { Point, Polygon } from '$lib/shared/geometry/geometry.type';
import { distance, is_point_in_polygon } from '$lib/shared/geometry/geometry';
import {
	computeCentralPath,
	getPlateMidpoint,
	type CentralPath
} from '$lib/shared/anatomy/central-path';

export type RangeHandle = 'superior' | 'inferior';

/** Matches `CentralLineController`'s existing hit-radius idiom -- screen-space constant,
 * divided by view scale at call sites so grab tolerance doesn't change with zoom. */
const HANDLE_HIT_RADIUS_PX = 14;

function role_plate(role: RangeHandle) {
	return role === 'superior' ? 'top' : 'bottom';
}

/** Nearest vertebra to `worldPoint`, judged by distance to THAT role's own endplate midpoint
 * (top-plate for the superior handle, bottom-plate for the inferior handle) -- matches the
 * spec's "snaps to the nearest anatomical feature: the top endplate of the superior vertebra /
 * bottom endplate of the inferior vertebra" wording exactly. Unbounded (always returns an
 * index) -- only used mid-drag, where "must always track somewhere" is the right feel for a
 * slider. `polygons` must be non-empty. */
export function nearestVertebraByPlate(
	polygons: Polygon[],
	role: RangeHandle,
	worldPoint: Point
): number {
	let bestIdx = 0;
	let bestDist = Infinity;
	polygons.forEach((poly, i) => {
		const d = distance(getPlateMidpoint(poly, role_plate(role)), worldPoint);
		if (d < bestDist) {
			bestDist = d;
			bestIdx = i;
		}
	});
	return bestIdx;
}

/** Point-in-polygon hit test for Shift+Click -- the schematic body IS the real polygon (per
 * the confirmed rendering decision), so a click "inside the shape" is the natural target.
 * First match wins (spine-ordered vertebrae shouldn't overlap). */
export function hitTestVertebraBody(polygons: Polygon[], worldPoint: Point): number | null {
	const idx = polygons.findIndex((p) => is_point_in_polygon(worldPoint, p.points));
	return idx === -1 ? null : idx;
}

/**
 * Owns the vertebra-range selection state for the segment-range picker modal: two boundary
 * handles (superior/inferior), draggable along the spine or settable via Shift+click on a
 * vertebra body. Deliberately thinner than `CentralLineController`: no undo/history, no
 * persistence until the modal's own confirm action, and no `InstanceContainer`/session
 * coupling -- it only ever *reads* polygons (via a plain getter), never mutates annotations.
 */
export class SegmentRangePicker {
	superiorIndex = $state<number | null>(null);
	inferiorIndex = $state<number | null>(null);
	private anchorIndex = $state<number | null>(null);
	private draggingHandle = $state<RangeHandle | null>(null);

	readonly centralPath: CentralPath | null = $derived.by(() =>
		computeCentralPath(this.getPolygons())
	);

	/** Defaults to the full spine selected (every currently-annotated vertebra on this
	 * projection) rather than an empty selection -- the common case is creating a segment
	 * spanning most/all of the spine, and a full default selection lets the user narrow it
	 * down (drag a handle inward, or Shift+click a shorter range) instead of having to build
	 * one up from nothing every time. */
	constructor(private getPolygons: () => Polygon[]) {
		const polygons = getPolygons();
		if (polygons.length > 0) {
			this.inferiorIndex = 0;
			this.superiorIndex = polygons.length - 1;
		}
	}

	get polygons(): Polygon[] {
		return this.getPolygons();
	}

	get isDragging(): boolean {
		return this.draggingHandle !== null;
	}

	get hasSelection(): boolean {
		return this.superiorIndex !== null && this.inferiorIndex !== null;
	}

	/** `{ topId, bottomId }` for the current selection, or null if incomplete. */
	get range(): { topId: string; bottomId: string } | null {
		if (this.superiorIndex === null || this.inferiorIndex === null) return null;
		const polygons = this.getPolygons();
		return { topId: polygons[this.superiorIndex].id, bottomId: polygons[this.inferiorIndex].id };
	}

	/** Nearest of the two CURRENT handle positions, within a screen-space radius -- null if no
	 * selection exists yet (nothing to grab) or nothing is close enough. */
	hitTestHandle(worldPoint: Point, viewScale: number): RangeHandle | null {
		if (this.superiorIndex === null || this.inferiorIndex === null) return null;
		const polygons = this.getPolygons();
		const worldHitRadius = HANDLE_HIT_RADIUS_PX / viewScale;

		const candidates: [RangeHandle, Point][] = [
			['superior', getPlateMidpoint(polygons[this.superiorIndex], 'top')],
			['inferior', getPlateMidpoint(polygons[this.inferiorIndex], 'bottom')]
		];

		let best: RangeHandle | null = null;
		let bestDist = worldHitRadius;
		for (const [handle, point] of candidates) {
			const d = distance(point, worldPoint);
			if (d < bestDist) {
				bestDist = d;
				best = handle;
			}
		}
		return best;
	}

	hitTestVertebraBody(worldPoint: Point): number | null {
		return hitTestVertebraBody(this.getPolygons(), worldPoint);
	}

	beginDragHandle(e: PointerEvent, handle: RangeHandle): void {
		this.draggingHandle = handle;
		if (e.target instanceof Element) {
			e.target.setPointerCapture(e.pointerId);
		}
	}

	/** Snaps to the nearest vertebra by that handle's own endplate, then clamps so the dragged
	 * handle can never cross the other one (crossing is disallowed, not swapped -- keeps
	 * "superior" always meaning "toward C2" and avoids a confusing role-flip mid-drag). */
	updateDragHandle(worldPoint: Point): void {
		if (!this.draggingHandle) return;
		const polygons = this.getPolygons();
		let idx = nearestVertebraByPlate(polygons, this.draggingHandle, worldPoint);

		if (this.draggingHandle === 'superior') {
			if (this.inferiorIndex !== null) idx = Math.max(idx, this.inferiorIndex);
			this.superiorIndex = idx;
		} else {
			if (this.superiorIndex !== null) idx = Math.min(idx, this.superiorIndex);
			this.inferiorIndex = idx;
		}
	}

	endDragHandle(e: PointerEvent): void {
		this.draggingHandle = null;
		if (e.target instanceof Element) {
			e.target.releasePointerCapture(e.pointerId);
		}
	}

	/** Plain click: sets a single-vertebra selection and a new anchor. Shift+click (with an
	 * existing anchor): expands to [min(anchor, index), max(anchor, index)] regardless of click
	 * order, per spec -- the anchor itself is left unchanged so repeated Shift+clicks keep
	 * extending/shrinking from the same starting vertebra. */
	selectVertebra(index: number, shiftKey: boolean): void {
		if (!shiftKey || this.anchorIndex === null) {
			this.anchorIndex = index;
			this.superiorIndex = index;
			this.inferiorIndex = index;
			return;
		}
		this.inferiorIndex = Math.min(this.anchorIndex, index);
		this.superiorIndex = Math.max(this.anchorIndex, index);
	}
}
