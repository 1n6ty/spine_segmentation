import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import type { LayoutLoad } from './$types';
import { detect_url_lang } from '$lib/core/i18n/url-lang';

// Universal (not server) load — this app is a pure SPA (adapter-static,
// fallback: 'index.html'), so a +layout.server.ts here would require a
// __data.json fetch that no server exists to serve for any non-prerendered
// route, 404ing the whole app on first navigation.
//
// This only fires for the true root path `/` (zero path segments) — for
// anything else, `[lang]` structurally captures the first segment (whatever
// it is), so the "is this actually a valid lang?" check lives in
// `[lang]/+layout.ts` instead, which can also preserve the rest of the path.
export const load: LayoutLoad = ({ params }) => {
	if (!params.lang) {
		const browser_lang = browser ? navigator.language : 'en';
		const lang = detect_url_lang(browser_lang);

		throw redirect(303, `/${lang}`);
	}
};
