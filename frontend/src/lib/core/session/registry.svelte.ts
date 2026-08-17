import { del, get } from '$lib/core/network/client';
import { parse_dicom_date } from '$lib/features/dicom/parser';
import type { SessionValue } from './types';

// Mirrors backend/Mainland/Dicom/v1/schemas/user_recent_studies.py's
// UserRecentStudies_Ref_Schema wire shape.
type RecentStudyRefRow = {
	id: number;
	patient_name: string | null;
	patient_birth_date: string | null;
	patient_uid: string | null;
	thumbnail: string | null;
	side_present: boolean;
	frontal_present: boolean;
	last_accessed: string;
};

function toSessionValue(row: RecentStudyRefRow): SessionValue {
	return {
		sessionUID: String(row.id),
		thumbnail: row.thumbnail,
		brief: {
			patientName: row.patient_name,
			patientBirthdate: parse_dicom_date(row.patient_birth_date),
			patientUID: row.patient_uid
		},
		sidePresent: row.side_present,
		frontalPresent: row.frontal_present,
		lastAccessed: new Date(row.last_accessed).getTime()
	};
}

/**
 * Thin wrapper over GET/DELETE /api/dcm/recent-studies/ -- the backend is the
 * only source of truth (ownership-scoped there), so there's no local
 * multi-account bookkeeping left to do here, unlike the old IndexedDB-backed
 * version. No TTL cleanup either: rows persist until the user deletes them.
 */
class RegistryService {
	ready = $state<boolean>(false);
	sessionValues = $state<Record<string, SessionValue>>({});

	/** Optimistic, purely-local thumbnail previews keyed by sessionUID --
	 * never sent to the backend. Set right after a client-side upload
	 * (SessionService.uploadFile) so an already-visible session's card shows
	 * an instant preview without waiting on a round trip; Card.svelte only
	 * ever falls back to this when the row's own server-authoritative
	 * thumbnail (generated server-side, CAS-deduplicated -- see
	 * Dicom.utils.thumbnail) hasn't arrived yet. */
	localThumbnails = $state<Record<string, string>>({});

	setLocalThumbnail(sessionUID: string, dataUri: string): void {
		this.localThumbnails = { ...this.localThumbnails, [sessionUID]: dataUri };
	}

	constructor() {
		// Fires immediately at module load, before any explicit auth check --
		// relies on the browser already sending the session cookie, same as
		// every other same-origin fetch in this app. 401s resolve to an empty
		// list rather than blocking `ready`, since +layout.svelte gates the
		// entire app (including the public login page) on it.
		this.refresh();
	}

	/** Re-fetches the current user's recent studies. Called eagerly on
	 * construction, and again by authService.verify() on every confirmed
	 * login so a freshly-authenticated session actually sees its list. */
	async refresh(): Promise<void> {
		try {
			const res = await get('/api/dcm/recent-studies/?page_size=100');
			if (!res.ok) {
				this.sessionValues = {};
				return;
			}

			const body = await res.json();
			const rows = (body?.data?.recent_studies ?? []) as RecentStudyRefRow[];
			const buf: Record<string, SessionValue> = {};
			rows.forEach((row) => {
				buf[String(row.id)] = toSessionValue(row);
			});
			this.sessionValues = buf;

			// Prune local overrides for rows that now have their own
			// server-authoritative thumbnail (or no longer exist at all) --
			// Card.svelte already prefers the real one once present, this just
			// stops holding onto data URIs nothing will ever read again.
			const staleOverrides = Object.keys(this.localThumbnails).filter(
				(sessionUID) => buf[sessionUID]?.thumbnail
			);
			if (staleOverrides.length > 0) {
				const prunedThumbnails = { ...this.localThumbnails };
				staleOverrides.forEach((sessionUID) => delete prunedThumbnails[sessionUID]);
				this.localThumbnails = prunedThumbnails;
			}
		} catch (err) {
			console.error('RegistryService: failed to refresh recent studies', err);
		} finally {
			this.ready = true;
		}
	}

	/** Drops the locally-held list without touching the backend -- used on
	 * logout, so a subsequent user on the same browser never sees a stale
	 * flash of the previous account's sessions before the next refresh(). */
	clear(): void {
		this.sessionValues = {};
		this.localThumbnails = {};
	}

	async delete(sessionUID: string): Promise<void> {
		if (!this.sessionValues[sessionUID]) return;

		const newValues = { ...this.sessionValues };
		delete newValues[sessionUID];
		this.sessionValues = newValues;

		if (this.localThumbnails[sessionUID]) {
			const prunedThumbnails = { ...this.localThumbnails };
			delete prunedThumbnails[sessionUID];
			this.localThumbnails = prunedThumbnails;
		}

		await del(`/api/dcm/recent-studies/${sessionUID}/`);
	}

	async clearAll(): Promise<void> {
		this.sessionValues = {};
		this.localThumbnails = {};
		await del('/api/dcm/recent-studies/clear-all/');
	}
}

export const registry = new RegistryService();
