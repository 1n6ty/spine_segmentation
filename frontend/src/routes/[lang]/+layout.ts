import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import type { LayoutLoad } from './$types';
import { is_supported_url_lang, detect_url_lang } from '$lib/core/i18n/url-lang';

// `[lang]` structurally captures ANY first path segment — visiting `/login`
// (no lang prefix) matches `params.lang = "login"`, not a redirect. This is
// the actual fix for that: if the captured segment isn't a real lang code,
// treat it as a page path with a missing prefix and redirect to
// `/${detected_lang}${original_path}`, preserving what was mistakenly
// captured here instead of discarding it.
export const load: LayoutLoad = ({ params, url }) => {
	if (!is_supported_url_lang(params.lang)) {
		const browser_lang = browser ? navigator.language : 'en';
		const lang = detect_url_lang(browser_lang);

		throw redirect(303, `/${lang}${url.pathname}${url.search}`);
	}

	return {
		lang: params.lang
	};
};
