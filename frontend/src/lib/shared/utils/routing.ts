/** The four tabs a research can be viewed under -- mirrors the route folders
 * under `routes/[lang]/(authenticated)/(studies)/researches/[research_id]/`.
 * Gated behind the Dicom.access_studies permission -- see that route group's
 * `+layout.svelte`. */
const RESEARCH_TABS = ['patient', 'edit', 'measure', 'report'] as const;
export type ResearchTab = (typeof RESEARCH_TABS)[number];

/** Picks out whichever of the four tabs `pathname` currently ends with, or
 * 'patient' as the default landing tab when it doesn't end with any of them
 * (e.g. navigating in from the bare `/{lang}` landing page, which has no tab
 * segment at all). */
export function current_research_tab(pathname: string): ResearchTab {
	return RESEARCH_TABS.find((tab) => pathname.endsWith(`/${tab}`)) ?? 'patient';
}

/** Builds the URL for a specific research, preserving whichever tab the user
 * is currently on (or defaulting to 'patient') -- the single place
 * file-upload and research-switch navigation (DicomUploadCard.svelte,
 * Card.svelte) construct this link, so the two can never drift apart. */
export function research_url(lang: string, research_id: string, current_pathname: string): string {
	return `/${lang}/researches/${research_id}/${current_research_tab(current_pathname)}`;
}
