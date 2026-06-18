import { register, init, waitLocale } from 'svelte-i18n';

// Register locales
export const supportedLocales = ['en-US', 'ru-RU'] as const;

// Static literal imports, not a templated dynamic import — Vite's
// dynamic-import-vars analysis can't resolve `./${l}.json` when the importing
// module lives in the same directory as the files it imports, and fails only
// during the adapter-static SSR prerender step (not in dev), with
// ERR_MODULE_NOT_FOUND.
const localeLoaders: Record<typeof supportedLocales[number], () => Promise<{ default: Record<string, unknown> }>> = {
  'en-US': () => import('./en-US.json'),
  'ru-RU': () => import('./ru-RU.json'),
};
supportedLocales.forEach(l => {
  register(l, localeLoaders[l]);
});

// Initialize
init({
  fallbackLocale: 'en-US',
  initialLocale: 'en-US',
});

class I18nState {
  i18nReady = $state<boolean>(false);

  constructor() {
    waitLocale().then(() => {
      this.i18nReady = true;
    });
  }
}

export const i18nState = new I18nState();