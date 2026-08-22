import { get, patch_json, post, post_json } from '$lib/core/network/client';
import { PROJECTION_TO_FILE_ROLE_SLUG } from '$lib/features/dicom/types';
import type { Patient, Projection, Series, Study } from '$lib/features/dicom/types';
import { DEFAULT_SEGMENT_DEFINITIONS } from '$lib/features/medical-parameters/diagnosis/regions';
import { PatientService } from './patient.svelte';
import { registry } from './registry.svelte';
import type { SeriesService } from './series.svelte';
import type { StudyService } from './study.svelte';
import type { SessionProjection } from './types';
import * as dicom_parser_lib from 'dicom-parser';

/*
 * The strategy here: nothing about a session persists client-side at all
 * anymore -- not the DICOM bytes/polygons (no IndexedDB, no Cache Storage),
 * and not even the session id (no localStorage). The backend's
 * UserRecentStudies rows, scoped to `owner=request.user`, are the only
 * record of "whose sessions are these" -- ownership via the auth cookie is
 * what identifies "mine", not anything stored in the browser. There is no
 * "resume my last session automatically" on load, by design -- project.session
 * starts (and returns to, on any route naming no research) empty; a specific
 * research is only ever selected by an explicit action (upload, clicking a
 * recent-studies card, or the researches/[research_id] URL naming one).
 */

/** null = start empty (a brand-new, unsaved session); a real id = reactivate
 * that specific known session (e.g. clicking a card in the recent-studies
 * list, or the researches/[research_id] URL naming one). */
export type SessionUIDArg = string | null;

/** Best-effort read of the backend's ApiResponse.details[0].message for a
 * failed /api/dcm/parse/ call (e.g. a validation error) -- falls back to null
 * if the body isn't JSON-shaped as expected, so the caller can fall back to a
 * generic status-code message instead. */
async function extract_error_message(res: Response): Promise<string | null> {
	try {
		const body = await res.json();
		return body?.details?.[0]?.message ?? body?.message ?? null;
	} catch {
		return null;
	}
}

type RecentStudyDetail = {
	data: {
		id: number;
		side_sop_instance_uid: string | null;
		side_polygons: unknown[];
		side_segments: unknown[];
		frontal_sop_instance_uid: string | null;
		frontal_polygons: unknown[];
		frontal_segments: unknown[];
	};
};

export class SessionService {
	loadingPromise: Promise<void>;

	/** The id/intent this instance was constructed with -- set synchronously,
	 * unlike `sessionUID` (only populated once the server round trip in
	 * restoreFromServer resolves, for a real id). Lets a caller that just
	 * constructed this exact session (e.g. the researches/[research_id]
	 * route's URL-sync layout, right after Card.svelte or DicomUploadCard's
	 * own resetSession()/upload) check "is this already the session I asked
	 * for" without racing the network and redundantly re-fetching it. */
	readonly requestedUID: SessionUIDArg;

	sessionUID = $state<string>('');
	lastTimeAccessed = $state<number>(0);
	projections = $state<
		Record<
			Projection,
			SessionProjection & { arrayBuffer: ArrayBuffer | null; patient: PatientService | null }
		>
	>({
		side: {
			sopInstanceUid: '',
			arrayBuffer: null,
			patient: null,
			polygons: [],
			segments: DEFAULT_SEGMENT_DEFINITIONS
		},
		frontal: {
			sopInstanceUid: '',
			arrayBuffer: null,
			patient: null,
			polygons: [],
			segments: DEFAULT_SEGMENT_DEFINITIONS
		}
	});

	private async restoreFromServer(sessionUID: SessionUIDArg) {
		if (!sessionUID) return;

		const url = `/api/dcm/recent-studies/${sessionUID}/`;

		try {
			const res = await get(url);
			if (!res.ok) {
				throw new Error(`Session ${sessionUID} could not be loaded (${res.status})`);
			}
			const body = (await res.json()) as RecentStudyDetail;
			const detail = body.data;

			const slots: {
				key: Projection;
				sopInstanceUid: string | null;
				polygons: SessionProjection['polygons'];
				segments: SessionProjection['segments'];
			}[] = [
				{
					key: 'side',
					sopInstanceUid: detail.side_sop_instance_uid,
					polygons: (detail.side_polygons ?? []) as SessionProjection['polygons'],
					segments:
						(detail.side_segments ?? []).length > 0
							? (detail.side_segments as SessionProjection['segments'])
							: DEFAULT_SEGMENT_DEFINITIONS
				},
				{
					key: 'frontal',
					sopInstanceUid: detail.frontal_sop_instance_uid,
					polygons: (detail.frontal_polygons ?? []) as SessionProjection['polygons'],
					segments:
						(detail.frontal_segments ?? []).length > 0
							? (detail.frontal_segments as SessionProjection['segments'])
							: DEFAULT_SEGMENT_DEFINITIONS
				}
			];

			// 1. Fetch all binary data in parallel first, same as before -- keeps
			// the "logic" separate from the "state update".
			const hydrationResults = await Promise.all(
				slots.map(async (slot) => {
					if (!slot.sopInstanceUid) return null;

					const fileRes = await get(`/api/dcm/${encodeURIComponent(slot.sopInstanceUid)}/file/`);
					if (!fileRes.ok) {
						console.warn(`File missing for SOP Instance UID: ${slot.sopInstanceUid}`);
						return null;
					}

					const arrayBuffer = await fileRes.arrayBuffer();
					const dataSet = dicom_parser_lib.parseDicom(new Uint8Array(arrayBuffer));

					return {
						key: slot.key,
						sopInstanceUid: slot.sopInstanceUid,
						polygons: slot.polygons,
						segments: slot.segments,
						arrayBuffer,
						patient: new PatientService(this, dataSet)
					};
				})
			);

			// 2. Batch the state update, same reasoning as before -- avoid the UI
			// flickering through "half-loaded" states.
			this.sessionUID = String(detail.id);
			this.lastTimeAccessed = Date.now();

			for (const res of hydrationResults) {
				if (!res) continue;

				const target = this.projections[res.key];
				target.sopInstanceUid = res.sopInstanceUid;
				target.polygons = res.polygons;
				target.segments = res.segments;
				target.arrayBuffer = res.arrayBuffer;
				target.patient = res.patient;
			}

			// No requestSave() here, unlike the old IndexedDB-backed version --
			// the retrieve endpoint itself already bumped last_accessed server-side.
		} catch (error) {
			// Rethrow so the {#await} block catch branch can see it
			console.error('Session Restoration Critical Error:', error);
			throw error;
		}
	}

	async uploadFile(file: File, projection: Projection) {
		if (!this.sessionUID) {
			const created = await post_json<{ data: { id: number } }>('/api/dcm/recent-studies/', {});
			this.sessionUID = String(created.data.id);
		}

		const arrayBuffer = await file.arrayBuffer();
		const dataSet = dicom_parser_lib.parseDicom(new Uint8Array(arrayBuffer));
		const patient = new PatientService(this, dataSet);
		const sopInstanceUid = patient.study.series.sopInstance.sopInstanceUID;

		// The side and frontal images of a session must be the same real DICOM
		// acquisition -- i.e. share a Series -- mirrors the same check the
		// backend enforces in Dicom.v1.views.user_recent_studies's `projection`
		// action. Checked here too, before any network call, so a mismatched
		// file is rejected instantly instead of round-tripping to the server
		// first only to be rejected there.
		const otherProjection: Projection = projection === 'side' ? 'frontal' : 'side';
		const otherSeriesUid = this.projections[otherProjection].patient?.study.series.seriesUID;
		const newSeriesUid = patient.study.series.seriesUID;
		if (otherSeriesUid && newSeriesUid && otherSeriesUid !== newSeriesUid) {
			throw new Error(
				`This ${projection} image belongs to a different DICOM Series than the ` +
					`already-attached ${otherProjection} image. Both projections must be the ` +
					`same acquisition.`
			);
		}

		// Persist server-side first: parse+store (this also kicks off AI
		// segmentation), then attach the resulting DicomImage to this
		// session's projection slot. Every upload goes through this now --
		// there is no local-only mode. Local state is only committed once
		// both calls succeed, so a rejected upload never leaves this
		// projection showing as "accepted" in the UI when the backend never
		// actually stored it.
		const form_data = new FormData();
		form_data.append('file', file);
		form_data.append('file_role_slug', PROJECTION_TO_FILE_ROLE_SLUG[projection]);
		const parseRes = await post('/api/dcm/parse/', { form: form_data });
		if (!parseRes.ok) {
			const message = await extract_error_message(parseRes);
			throw new Error(message ?? `DICOM upload failed (${parseRes.status})`);
		}

		await patch_json(`/api/dcm/recent-studies/${this.sessionUID}/projections/${projection}/`, {
			sop_instance_uid: sopInstanceUid
		});

		this.projections[projection].arrayBuffer = arrayBuffer;
		this.projections[projection].patient = patient;
		this.projections[projection].sopInstanceUid = sopInstanceUid;

		// Purely-local, never-uploaded preview -- the server already rendered
		// and CAS-stored its own canonical thumbnail synchronously as part of
		// the /api/dcm/parse/ call above (Dicom.utils.thumbnail), so this only
		// exists to make an already-visible session's card update instantly
		// instead of waiting on requestSave()'s debounce + a refresh() round
		// trip. Not awaited -- purely cosmetic, must never delay the upload.
		this.buildLocalThumbnailPreview().catch((err) => {
			console.warn('Failed to build local thumbnail preview:', err);
		});

		// AI segmentation was just triggered server-side by the parse call above,
		// but its result is never auto-applied here -- polygons only ever appear
		// on screen via the explicit Autofill flow (features/autofill/autofill.ts),
		// so a fresh upload/session never silently shows AI-generated points the
		// user hasn't asked to see yet.
		this.requestSave();
	}

	/** Renders a 128x128 letterboxed JPEG preview of whichever projection's
	 * bitmap is ready, purely client-side -- mirrors the server's own fit-
	 * and-center math (Dicom.utils.thumbnail) so the two look the same. Never
	 * transferred anywhere; only ever stored in registry.localThumbnails as
	 * an optimistic stand-in for the server-generated one. */
	private async buildLocalThumbnailPreview() {
		if (!this.sessionUID) return;

		const sopInstance =
			this.projections.side.patient?.study.series.sopInstance ||
			this.projections.frontal.patient?.study.series.sopInstance;
		const bitmap = sopInstance ? await sopInstance.bitmapReady.catch(() => null) : null;
		if (!bitmap) return;

		const offscreen = new OffscreenCanvas(128, 128);
		const ctx = offscreen.getContext('2d');
		if (!ctx) return;

		const scale = Math.min(128 / bitmap.width, 128 / bitmap.height);
		const w = bitmap.width * scale;
		const h = bitmap.height * scale;
		ctx.drawImage(bitmap, (128 - w) / 2, (128 - h) / 2, w, h);

		const blob = await offscreen.convertToBlob({ type: 'image/jpeg', quality: 0.3 });
		const dataUri = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(blob);
		});

		registry.setLocalThumbnail(this.sessionUID, dataUri);
	}

	/** Every reference-point edit (add/move/delete a point, undo/redo, Autofill
	 * apply, Clear All) calls requestSave() again, which clears and reschedules
	 * this timer -- so a rapid burst of edits (e.g. dragging a point) produces
	 * one PATCH 2s after the *last* edit, not one per edit. */
	private static readonly SAVE_DEBOUNCE_MS = 2000;
	private saveTimeout: ReturnType<typeof setTimeout> | null = null;
	async requestSave() {
		if (!this.sessionUID) return;
		if (this.saveTimeout) clearTimeout(this.saveTimeout);

		const sessionUID = this.sessionUID;

		this.saveTimeout = setTimeout(async () => {
			this.lastTimeAccessed = Date.now();

			const saves: Promise<unknown>[] = [];

			(Object.keys(this.projections) as Projection[]).forEach((projection) => {
				const slot = this.projections[projection];
				if (!slot.sopInstanceUid) return;

				saves.push(
					patch_json(`/api/dcm/recent-studies/${sessionUID}/projections/${projection}/`, {
						polygons: $state.snapshot(slot.polygons),
						segments: $state.snapshot(slot.segments)
					}).catch((err) => {
						console.error(`Failed to save ${projection} polygons/segments:`, err);
					})
				);
			});

			await Promise.allSettled(saves);
			// registry.sessionValues (the Researches list) is populated once on
			// load/login -- without this, a save's effects (bumped
			// last_accessed, patient brief) only showed up after a full page
			// reload instead of updating the list live. The thumbnail itself is
			// no longer built/sent here at all -- see buildLocalThumbnailPreview
			// (purely local) and Dicom.utils.thumbnail (server-generated,
			// CAS-deduplicated, persisted during /api/dcm/parse/ itself).
			registry.refresh();
		}, SessionService.SAVE_DEBOUNCE_MS);
	}

	constructor(sessionUID: SessionUIDArg) {
		this.requestedUID = sessionUID;
		this.loadingPromise = this.restoreFromServer(sessionUID);
	}

	destroy() {
		Object.values(this.projections).forEach((p) => {
			p.arrayBuffer = null;
			if (p.patient) p.patient.destroy();
		});
	}

	// Just public getters of merged parameters

	mergedPatient = $derived.by(() => {
		const services = Object.values(this.projections)
			.map((p) => p.patient)
			.filter((s): s is PatientService => !!s);

		if (services.length === 0) return null;

		const [first, ...rest] = services;

		return rest.reduce(
			(acc, curr) => ({
				patientUID: acc.patientUID || curr.patientUID,
				name: acc.name || curr.name,
				birthDate: acc.birthDate || curr.birthDate,
				sex: acc.sex || curr.sex
			}),
			{
				patientUID: first.patientUID,
				name: first.name,
				birthDate: first.birthDate,
				sex: first.sex
			} satisfies Patient
		);
	});

	mergedStudy = $derived.by(() => {
		const services = Object.values(this.projections)
			.map((p) => p.patient?.study)
			.filter((s): s is StudyService => !!s);

		if (services.length === 0) return null;

		const [first, ...rest] = services;

		return rest.reduce(
			(acc, curr) => ({
				studyUID: acc.studyUID || curr.studyUID,
				studyDate: acc.studyDate || curr.studyDate,
				description: acc.description || curr.description,
				physicianName: acc.physicianName || curr.physicianName,
				institutionName: acc.institutionName || curr.institutionName,
				institutionAddress: acc.institutionAddress || curr.institutionAddress,
				stationName: acc.stationName || curr.stationName
			}),
			{
				studyUID: first.studyUID,
				studyDate: first.studyDate,
				description: first.description,
				physicianName: first.physicianName,
				institutionName: first.institutionName,
				institutionAddress: first.institutionAddress,
				stationName: first.stationName
			} satisfies Study
		);
	});

	mergedSeries = $derived.by(() => {
		const services = Object.values(this.projections)
			.map((p) => p.patient?.study?.series)
			.filter((s): s is SeriesService => !!s);

		if (services.length === 0) return null;

		const [first, ...rest] = services;

		return rest.reduce(
			(acc, curr) => ({
				seriesUID: acc.seriesUID || curr.seriesUID,
				modality: acc.modality || curr.modality,
				bodyPart: acc.bodyPart || curr.bodyPart
			}),
			{
				seriesUID: first.seriesUID,
				modality: first.modality,
				bodyPart: first.bodyPart
			} satisfies Series
		);
	});
}
