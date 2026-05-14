import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { supportedLocales } from '$lib/core/i18n/index.svelte';

export const load: LayoutServerLoad = async ({ request, params }) => {
    if (!params.lang) {
        const acceptLanguage = request.headers.get('accept-language');
        const browserLang = acceptLanguage?.split(',')[0] || 'en-US';

        // 2. Decide the final language (URL takes priority over Browser)
        const lang = (browserLang in supportedLocales) ? browserLang: 'en-US';

        throw redirect(303, `/${lang}`);
    }
};