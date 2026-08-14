import type { LocaleKey } from './types';

/**
 * URL-facing short language codes (RFC 3986-style, e.g. `/en/login`), kept
 * distinct from svelte-i18n's internal locale strings (`LocaleKey`, e.g.
 * "en-US") which every translation dictionary in this app is still keyed by.
 * This module is the single bridge between the two.
 */
export const supportedUrlLangs = ['en', 'ru'] as const;
export type UrlLang = (typeof supportedUrlLangs)[number];

const url_lang_to_locale_map: Record<UrlLang, LocaleKey> = {
	en: 'en-US',
	ru: 'ru-RU'
};

const locale_to_url_lang_map: Record<LocaleKey, UrlLang> = {
	'en-US': 'en',
	'ru-RU': 'ru'
};

export function is_supported_url_lang(value: string | undefined | null): value is UrlLang {
	return !!value && (supportedUrlLangs as readonly string[]).includes(value);
}

export function url_lang_to_locale(lang: UrlLang): LocaleKey {
	return url_lang_to_locale_map[lang];
}

export function locale_to_url_lang(locale: LocaleKey): UrlLang {
	return locale_to_url_lang_map[locale];
}

/**
 * Maps a BCP-47 browser language tag (e.g. "ru-RU", "ru", "en-GB") to one of
 * our supported short URL lang codes, defaulting to "en" if unrecognized.
 */
export function detect_url_lang(browser_lang: string): UrlLang {
	const primary = browser_lang.split('-')[0].toLowerCase();
	return is_supported_url_lang(primary) ? primary : 'en';
}
