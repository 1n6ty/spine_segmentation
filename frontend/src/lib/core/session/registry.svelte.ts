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

// Mirrors common/schemas/v1/pagination.py's Pagination_Meta_Schema.
type PaginationMeta = {
	total_items: number;
	total_pages: number;
	current_page: number;
	page_size: number;
	next: string | null;
	previous: string | null;
};

/** Rows per request. The backend caps page_size at 100 (see
 * Dicom/v1/paginations/user_recent_studies.py); 12 keeps each page cheap while
 * filling a couple of carousel widths. Also the skeleton-card count Manager
 * renders while the first page is still loading. */
export const PAGE_SIZE = 12;

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
 *
 * The list is loaded a page at a time: refresh() (re)loads page 1, loadMore()
 * appends the next page. `order` holds the ids in server order (most-recently-
 * accessed first); Manager.svelte renders a SkeletonCard for every slot between
 * `order.length` and `totalItems`.
 */
class RegistryService {
	ready = $state<boolean>(false);
	sessionValues = $state<Record<string, SessionValue>>({});

	/** Ids in server order (-last_accessed), appended page by page. */
	order = $state<string[]>([]);
	/** meta.total_items from the last successful page fetch. */
	totalItems = $state<number>(0);
	/** Highest page number successfully loaded (0 = nothing loaded yet). */
	loadedPages = $state<number>(0);
	/** A page fetch (refresh or loadMore) is in flight. */
	loading = $state<boolean>(false);

	/** Whether more rows exist server-side than are currently in `order`.
	 * A getter (not $derived) so it stays correct when read from plain TS
	 * (loadMore) as well as reactively from a component. */
	get hasMore(): boolean {
		return this.order.length < this.totalItems;
	}

	/** Bumped on every refresh() so a page fetch that resolves after a reset
	 * doesn't append its rows to the new (empty) order. */
	private generation = 0;

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
		// list rather than blocking `ready`.
		this.refresh();
	}

	/** Reloads page 1. Called eagerly on construction, by authService.verify()
	 * on every confirmed login (and every authenticated-layout mount), and
	 * after a debounced save so a bumped last_accessed / patient brief shows
	 * in the list live.
	 *
	 * The currently-loaded list stays on screen for the whole round trip --
	 * page 1 replaces `order` only once the response is in hand. Clearing up
	 * front made every one of the calls above flash a full set of skeletons.
	 * Any pages past the first that were loaded via loadMore() are dropped;
	 * the user re-pages them by scrolling, same as a fresh load. */
	async refresh(): Promise<void> {
		await this.loadPage(1, 'replace');
	}

	/** Fetches the next unloaded page and appends it. No-op while a fetch is
	 * already running or when every row is already loaded. */
	async loadMore(): Promise<void> {
		if (this.loading || !this.hasMore) return;
		await this.loadPage(this.loadedPages + 1, 'append');
	}

	private async loadPage(page: number, mode: 'replace' | 'append'): Promise<void> {
		const gen = ++this.generation;
		this.loading = true;
		try {
			const res = await get(`/api/dcm/recent-studies/?page=${page}&page_size=${PAGE_SIZE}`);
			if (gen !== this.generation) return;

			if (!res.ok) {
				// A failed reload of page 1 means the session is gone (401/403) --
				// drop the list so a stale account's cards don't linger. A failed
				// *append* just leaves what's already loaded untouched.
				if (mode === 'replace') {
					this.sessionValues = {};
					this.order = [];
					this.totalItems = 0;
					this.loadedPages = 0;
				}
				return;
			}

			const body = await res.json();
			if (gen !== this.generation) return;

			const rows = (body?.data?.recent_studies ?? []) as RecentStudyRefRow[];
			const meta = body?.data?.meta as PaginationMeta | undefined;

			const base = mode === 'replace' ? [] : this.order;
			const known: Record<string, true> = {};
			base.forEach((uid) => (known[uid] = true));
			const mergedValues = { ...this.sessionValues };
			const nextOrder = [...base];
			rows.forEach((row) => {
				const uid = String(row.id);
				mergedValues[uid] = toSessionValue(row);
				if (!known[uid]) {
					known[uid] = true;
					nextOrder.push(uid);
				}
			});
			this.sessionValues = mergedValues;
			this.order = nextOrder;
			this.totalItems = meta?.total_items ?? nextOrder.length;
			this.loadedPages = meta?.current_page ?? page;

			// Prune local overrides for rows that now have their own
			// server-authoritative thumbnail -- Card.svelte already prefers the
			// real one once present, this just stops holding onto data URIs
			// nothing will ever read again.
			const staleOverrides = Object.keys(this.localThumbnails).filter(
				(sessionUID) => mergedValues[sessionUID]?.thumbnail
			);
			if (staleOverrides.length > 0) {
				const prunedThumbnails = { ...this.localThumbnails };
				staleOverrides.forEach((sessionUID) => delete prunedThumbnails[sessionUID]);
				this.localThumbnails = prunedThumbnails;
			}
		} catch (err) {
			console.error('RegistryService: failed to load recent studies', err);
		} finally {
			if (gen === this.generation) this.loading = false;
			this.ready = true;
		}
	}

	/** Drops the locally-held list without touching the backend -- used on
	 * logout, so a subsequent user on the same browser never sees a stale
	 * flash of the previous account's sessions before the next refresh(). */
	clear(): void {
		this.generation += 1;
		this.sessionValues = {};
		this.localThumbnails = {};
		this.order = [];
		this.totalItems = 0;
		this.loadedPages = 0;
	}

	async delete(sessionUID: string): Promise<void> {
		if (!this.sessionValues[sessionUID]) return;

		const newValues = { ...this.sessionValues };
		delete newValues[sessionUID];
		this.sessionValues = newValues;

		if (this.order.includes(sessionUID)) {
			this.order = this.order.filter((uid) => uid !== sessionUID);
			this.totalItems = Math.max(0, this.totalItems - 1);
		}

		if (this.localThumbnails[sessionUID]) {
			const prunedThumbnails = { ...this.localThumbnails };
			delete prunedThumbnails[sessionUID];
			this.localThumbnails = prunedThumbnails;
		}

		await del(`/api/dcm/recent-studies/${sessionUID}/`);
	}

	async clearAll(): Promise<void> {
		this.clear();
		await del('/api/dcm/recent-studies/clear-all/');
	}
}

export const registry = new RegistryService();
