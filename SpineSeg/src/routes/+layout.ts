import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import type { LayoutLoad } from './$types';
import { supportedLocales } from '$lib/core/i18n/index.svelte';

// Universal (not server) load — this app is a pure SPA (adapter-static,
// fallback: 'index.html'), so a +layout.server.ts here would require a
// __data.json fetch that no server exists to serve for any non-prerendered
// route, 404ing the whole app on first navigation.
export const load: LayoutLoad = ({ params }) => {
	if (!params.lang) {
		const browserLang = browser ? navigator.language : 'en-US';
		const lang = supportedLocales.includes(browserLang as (typeof supportedLocales)[number])
			? browserLang
			: 'en-US';

		throw redirect(303, `/${lang}`);
	}
};
