import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class FakeImageData {
	constructor(
		public data: Uint8ClampedArray,
		public width: number,
		public height: number
	) {}
}

class FakeOffscreenCanvas {
	constructor(
		public width: number,
		public height: number
	) {}
	getContext() {
		return { drawImage: vi.fn() };
	}
	async convertToBlob() {
		return new Blob(['thumb'], { type: 'image/jpeg' });
	}
}

const { registry, FileCache, parseDicom } = vi.hoisted(() => ({
	registry: { sessionValues: {} as Record<string, any>, upsert: vi.fn() },
	FileCache: { load: vi.fn(), save: vi.fn() },
	parseDicom: vi.fn()
}));

vi.mock('./registry.svelte', () => ({ registry }));
vi.mock('$lib/core/storage/file-cache', () => ({ FileCache }));
vi.mock('dicom-parser', () => ({ parseDicom }));

beforeEach(() => {
	vi.stubGlobal('ImageData', FakeImageData);
	vi.stubGlobal(
		'createImageBitmap',
		vi.fn(async (image_data: FakeImageData) => ({
			__fake_bitmap: true,
			image_data,
			width: 10,
			height: 10,
			close: vi.fn()
		}))
	);
	vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
	registry.sessionValues = {};
	registry.upsert.mockClear();
	FileCache.load.mockReset();
	FileCache.save.mockReset();
	parseDicom.mockReset();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

import { SessionService } from './session.svelte';

function fake_dataset(string_overrides: Record<string, string> = {}) {
	const strings: Record<string, string> = {
		x00100020: 'PID1',
		x00100010: 'Doe',
		x00100030: '19900115',
		x00100040: 'M',
		x0020000d: 'STUDY1',
		x00080090: '',
		x0020000e: 'SERIES1',
		x00080018: 'SOP1',
		x00281053: '1',
		x00281052: '0',
		x00281050: '128',
		x00281051: '256',
		...string_overrides
	};
	const uint16s: Record<string, number> = {
		x00280010: 1,
		x00280011: 1,
		x00280100: 16,
		x00280103: 0
	};
	return {
		string: (tag: string) => strings[tag],
		uint16: (tag: string) => uint16s[tag],
		elements: { x7fe00010: { dataOffset: 0, length: 2 } },
		byteArray: { buffer: new ArrayBuffer(2) }
	};
}

describe('SessionService construction', () => {
	it('with a null sessionUID, resolves immediately with an empty session', async () => {
		const session = new SessionService(null);
		await session.loadingPromise;

		expect(session.sessionUID).toBe('');
		expect(session.projections.side.hash).toBe('');
	});

	it("restores a stored session's hash/polygons/patient from the registry + file cache", async () => {
		registry.sessionValues['s1'] = {
			sessionUID: 's1',
			lastAccessed: 12345,
			projections: {
				side: { hash: 'hash-side', polygons: [{ id: 'L5' }] },
				frontal: { hash: '', polygons: [] }
			}
		};
		FileCache.load.mockResolvedValue(new File(['x'], 'f.dcm'));
		parseDicom.mockReturnValue(fake_dataset());

		const session = new SessionService('s1');
		await session.loadingPromise;

		expect(session.sessionUID).toBe('s1');
		expect(session.lastTimeAccessed).toBe(12345);
		expect(session.projections.side.hash).toBe('hash-side');
		expect(session.projections.side.polygons).toEqual([{ id: 'L5' }]);
		expect(session.projections.side.patient).not.toBeNull();
		expect(session.projections.side.patient?.patientUID).toBe('PID1');
		expect(session.projections.frontal.hash).toBe('');
		expect(session.projections.frontal.patient).toBeNull();
	});

	it("throws (rejecting loadingPromise) when the referenced session isn't in the registry", async () => {
		const session = new SessionService('missing');
		await expect(session.loadingPromise).rejects.toThrow();
	});

	it('skips a projection whose cached file is missing', async () => {
		registry.sessionValues['s2'] = {
			sessionUID: 's2',
			lastAccessed: 1,
			projections: { side: { hash: 'gone', polygons: [] }, frontal: { hash: '', polygons: [] } }
		};
		FileCache.load.mockResolvedValue(null);

		const session = new SessionService('s2');
		await session.loadingPromise;

		expect(session.projections.side.patient).toBeNull();
	});
});

describe('SessionService.uploadFile', () => {
	it('assigns a sessionUID if none exists, saves the file, and hydrates the patient chain', async () => {
		FileCache.save.mockResolvedValue('new-hash');
		parseDicom.mockReturnValue(fake_dataset());

		const session = new SessionService(null);
		await session.loadingPromise;

		const file = new File(['dicom-bytes'], 'scan.dcm');
		await session.uploadFile(file, 'side');

		expect(session.sessionUID).not.toBe('');
		expect(session.projections.side.hash).toBe('new-hash');
		expect(session.projections.side.patient?.patientUID).toBe('PID1');
	});
});

describe('SessionService.destroy', () => {
	it('nulls out arrayBuffers and destroys any loaded patients', async () => {
		registry.sessionValues['s1'] = {
			sessionUID: 's1',
			lastAccessed: 1,
			projections: { side: { hash: 'h', polygons: [] }, frontal: { hash: '', polygons: [] } }
		};
		FileCache.load.mockResolvedValue(new File(['x'], 'f.dcm'));
		parseDicom.mockReturnValue(fake_dataset());

		const session = new SessionService('s1');
		await session.loadingPromise;
		const patient_destroy = vi.spyOn(session.projections.side.patient!, 'destroy');

		session.destroy();

		expect(session.projections.side.arrayBuffer).toBeNull();
		expect(patient_destroy).toHaveBeenCalled();
	});
});

describe('SessionService merged getters', () => {
	it('mergedPatient/mergedStudy/mergedSeries are null with no loaded projections', async () => {
		const session = new SessionService(null);
		await session.loadingPromise;

		expect(session.mergedPatient).toBeNull();
		expect(session.mergedStudy).toBeNull();
		expect(session.mergedSeries).toBeNull();
	});

	it('mergedPatient falls back to whichever projection has data when only one is loaded', async () => {
		registry.sessionValues['s1'] = {
			sessionUID: 's1',
			lastAccessed: 1,
			projections: { side: { hash: 'h', polygons: [] }, frontal: { hash: '', polygons: [] } }
		};
		FileCache.load.mockResolvedValue(new File(['x'], 'f.dcm'));
		parseDicom.mockReturnValue(fake_dataset());

		const session = new SessionService('s1');
		await session.loadingPromise;

		expect(session.mergedPatient?.patientUID).toBe('PID1');
	});

	it('mergedStudy/mergedSeries merge fields across both projections when both are loaded, preferring the first non-empty value', async () => {
		parseDicom
			.mockReturnValueOnce(fake_dataset({ x00080090: '' }))
			.mockReturnValueOnce(fake_dataset({ x00080090: 'Dr. Smith' }));

		const session = new SessionService(null);
		await session.loadingPromise;
		await session.uploadFile(new File(['a'], 'a.dcm'), 'side');
		await session.uploadFile(new File(['b'], 'b.dcm'), 'frontal');

		expect(session.mergedStudy?.physicianName).toBe('Dr. Smith');
		expect(session.mergedSeries?.seriesUID).toBe('SERIES1');
		expect(session.mergedPatient?.patientUID).toBe('PID1');
	});
});
