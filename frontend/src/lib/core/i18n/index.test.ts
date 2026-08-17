import { describe, it, expect, vi } from 'vitest';

const { register, init, waitLocale, locale_set } = vi.hoisted(() => ({
	register: vi.fn(),
	init: vi.fn(),
	waitLocale: vi.fn().mockResolvedValue(undefined),
	locale_set: vi.fn()
}));

vi.mock('svelte-i18n', () => ({
	register,
	init,
	waitLocale,
	locale: { set: locale_set }
}));

import { i18nState, supportedLocales, set_locale } from './index.svelte';

async function flush_microtasks() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('locale registration', () => {
	it('declares both supported locales', () => {
		expect(supportedLocales).toEqual(['en-US', 'ru-RU']);
	});

	it('registers a loader for each supported locale', () => {
		expect(register).toHaveBeenCalledWith('en-US', expect.any(Function));
		expect(register).toHaveBeenCalledWith('ru-RU', expect.any(Function));
	});

	it('initializes with en-US as both the fallback and initial locale', () => {
		expect(init).toHaveBeenCalledWith({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
	});
});

describe('i18nState', () => {
	it('becomes ready once waitLocale resolves', async () => {
		await flush_microtasks();
		expect(i18nState.i18nReady).toBe(true);
	});
});

describe('set_locale', () => {
	it('translates the URL-facing lang code to the svelte-i18n locale before setting it', () => {
		set_locale('en');
		expect(locale_set).toHaveBeenCalledWith('en-US');

		set_locale('ru');
		expect(locale_set).toHaveBeenCalledWith('ru-RU');
	});
});
