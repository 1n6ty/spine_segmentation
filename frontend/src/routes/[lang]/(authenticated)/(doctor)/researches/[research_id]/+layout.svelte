<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { project } from '$lib/core/project.svelte';

	let { children } = $props();

	/** Last research_id this effect actually synced against -- guards against
	 * re-running when project.session changes for a reason that has nothing to
	 * do with the URL (e.g. DicomUploadCard.svelte's "Clear" button, which
	 * resets to an empty session without navigating away on its own). */
	let lastSyncedId: string | undefined;

	$effect(() => {
		const researchId = page.params.research_id;
		if (researchId === lastSyncedId) return;
		lastSyncedId = researchId;

		// Already showing (or already loading) exactly this research -- true
		// right after Card.svelte/DicomUploadCard.svelte navigate here
		// themselves, having already called resetSession()/uploadFile() before
		// the goto(). sessionUID only settles once restoreFromServer's network
		// round trip resolves; requestedUID is set synchronously in the
		// constructor, so it's what makes the immediately-after-resetSession()
		// case (sessionUID still '') recognizable without an extra fetch.
		if (project.session.sessionUID === researchId || project.session.requestedUID === researchId) {
			return;
		}

		// Anything else -- a reload, a bookmarked/typed URL, browser back/
		// forward, or a stale id left over from a previous research -- must
		// load exactly the research the URL names.
		project.resetSession(researchId);
		project.session.loadingPromise.catch(() => {
			// Unknown/inaccessible research -- nothing to show at this URL;
			// send the user back to the landing page instead of leaving a
			// permanently-empty tab pinned to an id that can never resolve.
			goto(`/${page.params.lang}`);
		});
	});
</script>

{@render children()}
