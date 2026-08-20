import { SvelteSet } from 'svelte/reactivity';

/**
 * Multi-selection state for a set of entities identified by `uuid`. Generic over the entity
 * shape so it carries no knowledge of `Polygon`/vertebrae -- any future point-based entity can
 * reuse it as-is.
 */
export class SelectionState<TEntity extends { uuid: string }> {
	selected = new SvelteSet<string>();

	/**
	 * The Shift+Click range anchor -- the last plain-clicked item. Ctrl/Cmd+click toggles and
	 * box-select never move it, so repeated Shift+Clicks keep measuring from the same fixed
	 * starting point (file-explorer/spreadsheet convention), not from the last-clicked endpoint.
	 */
	anchor = $state<string | null>(null);

	readonly size = $derived(this.selected.size);
	readonly isEmpty = $derived(this.selected.size === 0);

	has(uuid: string): boolean {
		return this.selected.has(uuid);
	}

	isSelected(entity: TEntity): boolean {
		return this.selected.has(entity.uuid);
	}

	/** Plain click: replace the selection with just this item and move the anchor to it. */
	selectOnly(uuid: string): void {
		this.selected.clear();
		this.selected.add(uuid);
		this.anchor = uuid;
	}

	/** Ctrl/Cmd+click: add/remove this item without touching the anchor. */
	toggle(uuid: string): void {
		if (this.selected.has(uuid)) {
			this.selected.delete(uuid);
		} else {
			this.selected.add(uuid);
		}
	}

	/**
	 * Shift+click: replace the selection with the inclusive slice of `orderedUuids` between the
	 * current anchor and `uuid`. Falls back to `selectOnly` if there is no anchor, or the anchor
	 * is no longer present in `orderedUuids`. Does not move the anchor.
	 */
	selectRange(orderedUuids: string[], uuid: string): void {
		if (this.anchor === null) {
			this.selectOnly(uuid);
			return;
		}

		const anchorIndex = orderedUuids.indexOf(this.anchor);
		if (anchorIndex === -1) {
			this.selectOnly(uuid);
			return;
		}

		const targetIndex = orderedUuids.indexOf(uuid);
		if (targetIndex === -1) return;

		const [from, to] =
			anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];

		this.selected.clear();
		for (const u of orderedUuids.slice(from, to + 1)) this.selected.add(u);
	}

	/** Box-select (non-additive): replace the selection with exactly these uuids. */
	replaceWith(uuids: string[]): void {
		this.selected.clear();
		for (const uuid of uuids) this.selected.add(uuid);
	}

	/** Box-select with Shift held (additive): union these uuids into the current selection. */
	addAll(uuids: string[]): void {
		for (const uuid of uuids) this.selected.add(uuid);
	}

	clear(): void {
		this.selected.clear();
		this.anchor = null;
	}
}
