import { SessionService, type SessionUIDArg } from './session/session.svelte';
import { researcherService } from './session/researcher.svelte';
import { registry } from './session/registry.svelte';
import { authService } from './session/auth.svelte';

class Project {
	// Deliberately no "resume last-touched session on load" -- a research is
	// only ever selected by an explicit action (upload, a recent-studies card,
	// or the researches/[research_id] URL naming one). Every route that names
	// no research (the landing page, a bare /patient|/edit|/measure|/report
	// tab) must show this empty state, on a hard reload/typed URL exactly the
	// same as an in-app navigation -- see enterBareRoute().
	session = $state.raw(new SessionService(null));
	researcher = researcherService;
	registry = registry;
	auth = authService;

	/** Destroys the current session and replaces it with a fresh one --
	 * `null` (default) for a brand-new, unsaved session ("New research",
	 * logout, "delete all"), or a specific id to reactivate a known session
	 * (clicking a card in the recent-studies list). The single place this
	 * destroy+reconstruct sequence lives, instead of every `ui/` component
	 * that needs it importing `SessionService` and reimplementing it. */
	resetSession(sessionUID: SessionUIDArg = null) {
		this.session.destroy();
		this.session = new SessionService(sessionUID);
	}

	/** Called on mount by every route that names no research -- the landing
	 * page and the doctor tabs' own +layout.svelte, but never
	 * researches/[research_id]/+layout.svelte, which owns the opposite sync
	 * direction (selecting a research the URL names). Deselects unconditionally,
	 * every time, including a hard reload/typed URL -- there is no cold-start
	 * exception to preserve. */
	enterBareRoute() {
		if (this.session.sessionUID || this.session.requestedUID) {
			this.resetSession();
		}
	}
}

export const project = new Project();
