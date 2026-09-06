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

class FakeFileReader {
	result: string | null = null;
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	readAsDataURL() {
		queueMicrotask(() => {
			this.result = 'data:image/jpeg;base64,local-preview';
			this.onload?.();
		});
	}
}

async function* empty_stream() {
	// yields nothing -- default stand-in for stream_segmentation_events so
	// uploadFile's background seedInitialAiPolygons() just ends quietly.
}

const { get, post, post_json, patch, patch_json, parseDicom, stream_segmentation_events } =
	vi.hoisted(() => ({
		// Sane default so registry.svelte's eager, constructor-time refresh()
		// (fired the moment that module is first imported, via session.svelte's
		// own import of it -- before any beforeEach() has run) doesn't crash on
		// an unconfigured mock.
		get: vi.fn().mockResolvedValue({ ok: false }),
		post: vi.fn(),
		post_json: vi.fn(),
		patch: vi.fn(),
		patch_json: vi.fn(),
		parseDicom: vi.fn(),
		stream_segmentation_events: vi.fn()
	}));

vi.mock('$lib/core/network/client', () => ({ get, post, post_json, patch, patch_json }));
vi.mock('$lib/core/network/segmentation-events', () => ({ stream_segmentation_events }));
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
	vi.stubGlobal('FileReader', FakeFileReader);

	get.mockReset();
	post.mockReset();
	post_json.mockReset();
	patch.mockReset();
	patch_json.mockReset();
	parseDicom.mockReset();
	stream_segmentation_events.mockReset();

	post.mockResolvedValue({ ok: true });
	patch.mockResolvedValue({ ok: true });
	patch_json.mockResolvedValue({});
	stream_segmentation_events.mockReturnValue(empty_stream());
	// requestSave() calls registry.refresh() after saving, which shares this
	// same mocked `get` -- default to a graceful "no rows" response so tests
	// that don't care about the registry list don't hit an unconfigured mock.
	get.mockResolvedValue({ ok: false });
	registry.localThumbnails = {};
});

afterEach(() => {
	vi.unstubAllGlobals();
});

/** buildLocalThumbnailPreview (session.svelte.ts) is fire-and-forget --
 * uploadFile() never awaits it -- so tests asserting on its effect need to
 * let its bitmapReady -> convertToBlob -> FileReader chain actually settle
 * first. A macrotask flush guarantees every pending microtask in that chain
 * has run. */
async function flush_microtasks() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

import { SessionService } from './session.svelte';
import { registry } from './registry.svelte';

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

/** Routes the mocked `get` by URL shape -- detail vs raw-file fetch. */
function mock_get_routes(detail: unknown, file_ok = true) {
	get.mockImplementation(async (url: string) => {
		if (url.includes('/recent-studies/')) {
			return { ok: true, json: async () => ({ data: detail }) };
		}
		if (url.includes('/file/')) {
			if (!file_ok) return { ok: false };
			return { ok: true, arrayBuffer: async () => new ArrayBuffer(2) };
		}
		throw new Error(`Unexpected get(${url})`);
	});
}

describe('SessionService construction', () => {
	it('with a null sessionUID, resolves immediately with an empty session', async () => {
		const session = new SessionService(null);
		await session.loadingPromise;

		expect(session.sessionUID).toBe('');
		expect(session.projections.side.sopInstanceUid).toBe('');
		expect(get).not.toHaveBeenCalled();
	});

	it("restores a stored session's sopInstanceUid/polygons/patient from the backend", async () => {
		mock_get_routes({
			id: 1,
			side_sop_instance_uid: 'SOP1',
			side_polygons: [{ id: 'L5' }],
			frontal_sop_instance_uid: null,
			frontal_polygons: []
		});
		parseDicom.mockReturnValue(fake_dataset());

		const session = new SessionService('1');
		await session.loadingPromise;

		expect(session.sessionUID).toBe('1');
		expect(session.projections.side.sopInstanceUid).toBe('SOP1');
		expect(session.projections.side.polygons).toEqual([{ id: 'L5' }]);
		expect(session.projections.side.patient).not.toBeNull();
		expect(session.projections.side.patient?.patientUID).toBe('PID1');
		expect(session.projections.frontal.sopInstanceUid).toBe('');
		expect(session.projections.frontal.patient).toBeNull();
	});

	it('restores a stored session with previously-saved segments verbatim', async () => {
		const savedSegments = [{ id: 'custom', topId: 'C4', bottomId: 'Th2' }];
		mock_get_routes({
			id: 1,
			side_sop_instance_uid: 'SOP1',
			side_polygons: [],
			side_segments: savedSegments,
			frontal_sop_instance_uid: null,
			frontal_polygons: [],
			frontal_segments: []
		});
		parseDicom.mockReturnValue(fake_dataset());

		const session = new SessionService('1');
		await session.loadingPromise;

		expect(session.projections.side.segments).toEqual(savedSegments);
	});

	it('defaults to an empty array when a restored slot never saved any segments', async () => {
		mock_get_routes({
			id: 1,
			side_sop_instance_uid: 'SOP1',
			side_polygons: [],
			side_segments: [],
			frontal_sop_instance_uid: null,
			frontal_polygons: [],
			frontal_segments: []
		});
		parseDicom.mockReturnValue(fake_dataset());

		const session = new SessionService('1');
		await session.loadingPromise;

		expect(session.projections.side.segments).toEqual([]);
	});

	it('strips legacy default-region and generated entries from previously-saved segments', async () => {
		mock_get_routes({
			id: 1,
			side_sop_instance_uid: 'SOP1',
			side_polygons: [],
			side_segments: [
				{ id: 'cervical', topId: 'C2', bottomId: 'C7' },
				{ id: 'generated:S1-L3', topId: 'L3', bottomId: 'S1', generated: true },
				{ id: 'custom-uuid', topId: 'C4', bottomId: 'Th2' }
			],
			frontal_sop_instance_uid: null,
			frontal_polygons: [],
			frontal_segments: []
		});
		parseDicom.mockReturnValue(fake_dataset());

		const session = new SessionService('1');
		await session.loadingPromise;

		expect(session.projections.side.segments).toEqual([
			{ id: 'custom-uuid', topId: 'C4', bottomId: 'Th2' }
		]);
	});

	it("throws (rejecting loadingPromise) when an explicit, known session id isn't found", async () => {
		get.mockResolvedValue({ ok: false, status: 404 });

		const session = new SessionService('missing');
		await expect(session.loadingPromise).rejects.toThrow();
	});

	it('skips a projection whose file fetch fails', async () => {
		mock_get_routes(
			{
				id: 2,
				side_sop_instance_uid: 'SOP-GONE',
				side_polygons: [],
				frontal_sop_instance_uid: null,
				frontal_polygons: []
			},
			false
		);

		const session = new SessionService('2');
		await session.loadingPromise;

		expect(session.projections.side.patient).toBeNull();
	});
});

describe('SessionService.uploadFile', () => {
	it('creates a session, persists the file, and hydrates the patient chain', async () => {
		post_json.mockResolvedValue({ data: { id: 7 } });
		parseDicom.mockReturnValue(fake_dataset());

		const session = new SessionService(null);
		await session.loadingPromise;

		const file = new File(['dicom-bytes'], 'scan.dcm');
		await session.uploadFile(file, 'side');

		expect(session.sessionUID).toBe('7');
		expect(post_json).toHaveBeenCalledWith('/api/dcm/recent-studies/', {});
		expect(post).toHaveBeenCalledWith('/api/dcm/parse/', { form: expect.any(FormData) });
		const form_data = post.mock.calls[0][1].form as FormData;
		expect(form_data.get('file_role_slug')).toBe('DICOM_XRAY_SAGITTAL');
		expect(patch_json).toHaveBeenCalledWith('/api/dcm/recent-studies/7/projections/side/', {
			sop_instance_uid: 'SOP1'
		});
		expect(session.projections.side.sopInstanceUid).toBe('SOP1');
		expect(session.projections.side.patient?.patientUID).toBe('PID1');
	});

	it('builds a purely-local thumbnail preview and never PATCHes it to the backend', async () => {
		post_json.mockResolvedValue({ data: { id: 7 } });
		parseDicom.mockReturnValue(fake_dataset());

		const session = new SessionService(null);
		await session.loadingPromise;
		await session.uploadFile(new File(['dicom-bytes'], 'scan.dcm'), 'side');
		await flush_microtasks();

		expect(registry.localThumbnails['7']).toBe('data:image/jpeg;base64,local-preview');
		// No multipart/thumbnail PATCH anywhere -- the client-built preview is
		// display-only, the server renders and persists its own (Dicom.utils.thumbnail).
		expect(patch).not.toHaveBeenCalled();
	});

	it('reuses the existing sessionUID on a second upload instead of creating another session', async () => {
		post_json.mockResolvedValue({ data: { id: 7 } });
		parseDicom.mockReturnValue(fake_dataset());

		const session = new SessionService(null);
		await session.loadingPromise;
		await session.uploadFile(new File(['a'], 'a.dcm'), 'side');
		await session.uploadFile(new File(['b'], 'b.dcm'), 'frontal');

		expect(post_json).toHaveBeenCalledTimes(1);
		expect(session.sessionUID).toBe('7');
	});

	it('rejects a frontal upload whose Series differs from the already-attached side image, without any network call', async () => {
		post_json.mockResolvedValue({ data: { id: 7 } });
		parseDicom
			.mockReturnValueOnce(fake_dataset())
			.mockReturnValueOnce(fake_dataset({ x0020000e: 'SERIES-OTHER', x00080018: 'SOP-OTHER' }));

		const session = new SessionService(null);
		await session.loadingPromise;
		await session.uploadFile(new File(['a'], 'a.dcm'), 'side');
		post.mockClear();
		patch_json.mockClear();

		await expect(session.uploadFile(new File(['b'], 'b.dcm'), 'frontal')).rejects.toThrow(
			/different DICOM Series/
		);
		expect(post).not.toHaveBeenCalled();
		expect(patch_json).not.toHaveBeenCalled();
		expect(session.projections.frontal.sopInstanceUid).toBe('');
	});

	it('allows a frontal upload from the same Series as the already-attached side image', async () => {
		post_json.mockResolvedValue({ data: { id: 7 } });
		parseDicom
			.mockReturnValueOnce(fake_dataset())
			.mockReturnValueOnce(fake_dataset({ x00080018: 'SOP-FRONTAL' }));

		const session = new SessionService(null);
		await session.loadingPromise;
		await session.uploadFile(new File(['a'], 'a.dcm'), 'side');

		await expect(session.uploadFile(new File(['b'], 'b.dcm'), 'frontal')).resolves.toBeUndefined();
		expect(session.projections.frontal.sopInstanceUid).toBe('SOP-FRONTAL');
	});

	it('throws when the parse upload response is not ok', async () => {
		post_json.mockResolvedValue({ data: { id: 7 } });
		post.mockResolvedValue({ ok: false, status: 400 });
		parseDicom.mockReturnValue(fake_dataset());

		const session = new SessionService(null);
		await session.loadingPromise;

		await expect(session.uploadFile(new File(['a'], 'a.dcm'), 'side')).rejects.toThrow(
			'DICOM upload failed'
		);
	});

	it('never auto-applies AI-generated points -- polygons stay empty after upload even once segmentation is done', async () => {
		post_json.mockResolvedValue({ data: { id: 7 } });
		parseDicom.mockReturnValue(fake_dataset());
		async function* done_stream() {
			yield {
				status: 'done',
				ref_points: {
					vertebraes: [
						{
							name: 'L5',
							points: [
								[0, 0],
								[0, 1],
								[1, 1],
								[1, 0]
							]
						}
					]
				}
			};
		}
		stream_segmentation_events.mockReturnValue(done_stream());

		const session = new SessionService(null);
		await session.loadingPromise;
		await session.uploadFile(new File(['a'], 'a.dcm'), 'side');

		// Points only ever appear via the explicit Autofill flow
		// (features/autofill/autofill.ts's watchAutofillStatus) -- uploadFile()
		// itself never watches the stream at all, regardless of how fast
		// segmentation finishes.
		expect(stream_segmentation_events).not.toHaveBeenCalled();
		expect(session.projections.side.polygons).toHaveLength(0);
	});
});

describe('SessionService.requestSave', () => {
	it('debounces and PATCHes polygons for every populated projection', async () => {
		vi.useFakeTimers();
		try {
			post_json.mockResolvedValue({ data: { id: 7 } });
			parseDicom.mockReturnValue(fake_dataset());

			const session = new SessionService(null);
			await session.loadingPromise;
			await session.uploadFile(new File(['a'], 'a.dcm'), 'side');
			patch_json.mockClear();

			session.projections.side.polygons = [{ uuid: 'u1', id: 'L4', points: [] }];
			session.requestSave();

			// Just under the debounce window -- must not have fired yet.
			await vi.advanceTimersByTimeAsync(1999);
			expect(patch_json).not.toHaveBeenCalled();

			await vi.advanceTimersByTimeAsync(1);

			expect(patch_json).toHaveBeenCalledWith('/api/dcm/recent-studies/7/projections/side/', {
				polygons: [{ uuid: 'u1', id: 'L4', points: [] }],
				segments: []
			});
			// frontal slot has no sopInstanceUid yet -- never PATCHed.
			expect(patch_json).not.toHaveBeenCalledWith(
				expect.stringContaining('/projections/frontal/'),
				expect.anything()
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it('reschedules the debounce timer on every edit, so a burst of edits only PATCHes once', async () => {
		vi.useFakeTimers();
		try {
			post_json.mockResolvedValue({ data: { id: 7 } });
			parseDicom.mockReturnValue(fake_dataset());

			const session = new SessionService(null);
			await session.loadingPromise;
			await session.uploadFile(new File(['a'], 'a.dcm'), 'side');
			patch_json.mockClear();

			// Three edits in quick succession, each well inside the previous
			// call's 2s window -- must reschedule rather than stack up saves.
			session.projections.side.polygons = [{ uuid: 'u1', id: 'L4', points: [] }];
			session.requestSave();
			await vi.advanceTimersByTimeAsync(1000);
			expect(patch_json).not.toHaveBeenCalled();

			session.projections.side.polygons = [{ uuid: 'u2', id: 'L5', points: [] }];
			session.requestSave();
			await vi.advanceTimersByTimeAsync(1000);
			expect(patch_json).not.toHaveBeenCalled();

			session.projections.side.polygons = [{ uuid: 'u3', id: 'L3', points: [] }];
			session.requestSave();
			await vi.advanceTimersByTimeAsync(2000);

			expect(patch_json).toHaveBeenCalledTimes(1);
			expect(patch_json).toHaveBeenCalledWith('/api/dcm/recent-studies/7/projections/side/', {
				polygons: [{ uuid: 'u3', id: 'L3', points: [] }],
				segments: []
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it('is a no-op with no sessionUID yet', async () => {
		const session = new SessionService(null);
		await session.loadingPromise;

		await session.requestSave();

		expect(patch_json).not.toHaveBeenCalled();
		expect(patch).not.toHaveBeenCalled();
	});
});

describe('SessionService.destroy', () => {
	it('nulls out arrayBuffers and destroys any loaded patients', async () => {
		mock_get_routes({
			id: 1,
			side_sop_instance_uid: 'SOP1',
			side_polygons: [],
			frontal_sop_instance_uid: null,
			frontal_polygons: []
		});
		parseDicom.mockReturnValue(fake_dataset());

		const session = new SessionService('1');
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
		mock_get_routes({
			id: 1,
			side_sop_instance_uid: 'SOP1',
			side_polygons: [],
			frontal_sop_instance_uid: null,
			frontal_polygons: []
		});
		parseDicom.mockReturnValue(fake_dataset());

		const session = new SessionService('1');
		await session.loadingPromise;

		expect(session.mergedPatient?.patientUID).toBe('PID1');
	});

	it('mergedStudy/mergedSeries merge fields across both projections when both are loaded, preferring the first non-empty value', async () => {
		post_json.mockResolvedValue({ data: { id: 7 } });
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
