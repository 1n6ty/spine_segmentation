import { SessionService } from './session/session.svelte';
import { researcherService } from './session/researcher.svelte';
import { registry } from './session/registry.svelte';
import { authService } from './session/auth.svelte';

class Project {
	session = $state.raw(new SessionService(null));
	researcher = researcherService;
	registry = registry;
	auth = authService;
}

export const project = new Project();
