import { describe, it, expect } from 'vitest';
import {
	supportedUrlLangs,
	is_supported_url_lang,
	url_lang_to_locale,
	locale_to_url_lang,
	detect_url_lang
} from './url-lang';

describe('is_supported_url_lang', () => {
	it('accepts every supported url lang', () => {
		for (const lang of supportedUrlLangs) {
			expect(is_supported_url_lang(lang)).toBe(true);
		}
	});

	it('rejects an unsupported/garbage value', () => {
		expect(is_supported_url_lang('fr')).toBe(false);
		expect(is_supported_url_lang('')).toBe(false);
	});

	it('rejects null/undefined', () => {
		expect(is_supported_url_lang(null)).toBe(false);
		expect(is_supported_url_lang(undefined)).toBe(false);
	});
});

describe('url_lang_to_locale / locale_to_url_lang', () => {
	it('round-trips en <-> en-US', () => {
		expect(url_lang_to_locale('en')).toBe('en-US');
		expect(locale_to_url_lang('en-US')).toBe('en');
	});

	it('round-trips ru <-> ru-RU', () => {
		expect(url_lang_to_locale('ru')).toBe('ru-RU');
		expect(locale_to_url_lang('ru-RU')).toBe('ru');
	});
});

describe('detect_url_lang', () => {
	it('matches a supported primary subtag exactly', () => {
		expect(detect_url_lang('ru')).toBe('ru');
		expect(detect_url_lang('en')).toBe('en');
	});

	it('extracts the primary subtag from a region-qualified BCP-47 tag', () => {
		expect(detect_url_lang('ru-RU')).toBe('ru');
		expect(detect_url_lang('en-GB')).toBe('en');
	});

	it('is case-insensitive on the primary subtag', () => {
		expect(detect_url_lang('RU-ru')).toBe('ru');
	});

	it('defaults to en for an unrecognized language', () => {
		expect(detect_url_lang('fr-FR')).toBe('en');
		expect(detect_url_lang('de')).toBe('en');
	});
});
