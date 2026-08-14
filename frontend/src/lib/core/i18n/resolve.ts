import en_us from './en-US.json';
import ru_ru from './ru-RU.json';
import diagnosis_en_us from './diagnosis.en-US.json';
import diagnosis_ru_ru from './diagnosis.ru-RU.json';
import type { Localized, LocaleKey } from './types';

// Merged so rule/narrative code can reference existing UI keys (e.g. "units.linear")
// and diagnosis-only keys (e.g. "rules.sagittal.regional.cervical.normal") through
// one lookup path, without routing through svelte-i18n's reactive single-locale
// $t()/get() — findings are precomputed as Localized objects for both locales at
// once in framework-agnostic files, which $t()'s reactive resolution can't produce.
const dictionaries: Record<LocaleKey, Record<string, unknown>> = {
	'en-US': { ...en_us, diagnosis: diagnosis_en_us },
	'ru-RU': { ...ru_ru, diagnosis: diagnosis_ru_ru }
};

function get_by_path(dict: Record<string, unknown>, path: string): string {
	const value = path.split('.').reduce<unknown>((acc, segment) => {
		if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[segment];
		return undefined;
	}, dict);
	if (typeof value !== 'string') {
		throw new Error(`i18n: missing or non-string key "${path}"`);
	}
	return value;
}

type ResolveParams = Record<string, string | number | Localized>;

function interpolate(
	template: string,
	params: ResolveParams | undefined,
	locale: LocaleKey
): string {
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (match, name: string) => {
		const value = params[name];
		if (value === undefined) return match;
		if (typeof value === 'object') return value[locale];
		return String(value);
	});
}

/**
 * Resolves a dotted key path to BOTH locales at once, with optional
 * interpolation. A param value may itself be a `Localized` object (e.g. a
 * "left"/"right" word that must match the sentence's own locale) — in that
 * case the matching-locale variant is substituted per output locale.
 */
export function resolve_localized(key: string, params?: ResolveParams): Localized {
	return {
		'en-US': interpolate(get_by_path(dictionaries['en-US'], key), params, 'en-US'),
		'ru-RU': interpolate(get_by_path(dictionaries['ru-RU'], key), params, 'ru-RU')
	};
}
