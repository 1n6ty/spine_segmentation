import { get } from '$lib/core/network/client';
import { registry } from './registry.svelte';
import { researcherService } from './researcher.svelte';

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

// Mirrors the fields this file actually consumes from common/schemas/v1/domain/user.py's
// User_Item_Schema (backend) -- not the full shape (also has patronymic/phone/company/
// permissions), since nothing else here needs them yet.
type Me = {
	id: number;
	email: string;
	first_name: string;
	last_name: string;
	role: { slug: string; name: string } | null;
};

class AuthService {
	status = $state<AuthStatus>('unknown');

	/**
	 * The only source of truth for "am I logged in": asks the backend
	 * directly via `GET /api/profiles/me/` rather than trusting any
	 * locally-cached flag, so a deleted/expired session cookie actually
	 * revokes access instead of leaving stale protected content on screen.
	 */
	async verify(): Promise<boolean> {
		try {
			const res = await get('/api/profiles/me/');
			if (!res.ok) {
				this.reject();
				return false;
			}

			const body = await res.json();
			const me = body.data as Me;

			this.status = 'authenticated';
			researcherService.email = me.email;
			researcherService.fullName = [me.first_name, me.last_name].filter(Boolean).join(' ') || me.email;
			researcherService.duty = me.role?.name ?? null;
			registry.refresh();

			return true;
		} catch {
			this.reject();
			return false;
		}
	}

	/** Clears all locally-held identity/session state -- used on logout, and
	 * whenever `verify()` finds the backend no longer recognizes the session. */
	reject(): void {
		this.status = 'unauthenticated';
		researcherService.fullName = null;
		researcherService.email = null;
		researcherService.duty = null;
		registry.clear();
	}
}

export const authService = new AuthService();
