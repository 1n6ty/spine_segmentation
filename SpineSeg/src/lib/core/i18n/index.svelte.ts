import { register, init, waitLocale } from 'svelte-i18n';

// Register locales
export const supportedLocales = ['en-US', 'ru-RU'] as const;
supportedLocales.forEach(l => {
  register(l, () => import(`./${l}.json`));
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