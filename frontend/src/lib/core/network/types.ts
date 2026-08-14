export type SegmentationVertebra = {
	name: string;
	points: [number, number][];
};

export type SegmentationRefPoints = {
	vertebraes: SegmentationVertebra[];
};

export type SegmentationStatus =
	| 'image.processing'
	| 'segmentation.processing'
	| 'saving'
	| 'done'
	| 'error';
