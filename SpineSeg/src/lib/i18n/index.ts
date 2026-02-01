import { register, init, getLocaleFromNavigator, waitLocale } from 'svelte-i18n';

// Register locales
register('en', () => import('./en.json'));
register('ru', () => import('./ru.json'));

// Initialize
init({
  fallbackLocale: 'en',
  initialLocale: getLocaleFromNavigator(),
});

export const i18nReady = waitLocale();