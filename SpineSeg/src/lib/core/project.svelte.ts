import { SessionService } from "./session/session.svelte";

class Project {
    session = $state.raw(new SessionService(null));
};

export const project = new Project();