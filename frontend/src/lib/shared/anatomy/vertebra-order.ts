/**
 * Canonical anatomical ordering of the 24 vertebrae this app annotates, superior to
 * inferior. There is no C1 (atlas) anywhere in this system -- the annotated set starts
 * at C2. `editor/logic/orderer.ts`'s positional name-assignment array is the reverse of
 * this (it walks bottom-up, starting from S1), so it's derived from this array rather
 * than duplicated, per the "2+ places need it -> move up" rule.
 */
export const VERTEBRA_ORDER: string[] = [
	'C2',
	'C3',
	'C4',
	'C5',
	'C6',
	'C7',
	'Th1',
	'Th2',
	'Th3',
	'Th4',
	'Th5',
	'Th6',
	'Th7',
	'Th8',
	'Th9',
	'Th10',
	'Th11',
	'Th12',
	'L1',
	'L2',
	'L3',
	'L4',
	'L5',
	'S1'
];

/** Index of `id` in VERTEBRA_ORDER, or -1 if it isn't a known vertebra id. */
export function vertebra_order_index(id: string): number {
	return VERTEBRA_ORDER.indexOf(id);
}
