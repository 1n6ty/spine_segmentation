import type { LayoutLoad } from './$types';
import { locale } from 'svelte-i18n';

export const load: LayoutLoad = async ({ params }) => {
  const lang = params.lang;
  locale.set(lang);

  return { lang };
};