<script lang="ts">
	import { t, locale } from 'svelte-i18n';
	import { SvelteSet } from 'svelte/reactivity';
	import type { LocaleKey } from '$lib/core/i18n/types';
	import { resolve_localized } from '$lib/core/i18n/resolve';

	import boneSVG from '$lib/assets/icons/bone.svg';
	import downSVG from '$lib/assets/icons/down.svg';
	import downloadSVG from '$lib/assets/icons/download.svg';
	import documentSVG from '$lib/assets/icons/document.svg';
	import printSVG from '$lib/assets/icons/print.svg';

	import SessionLoadingGate from '$lib/components/ui/sessions/SessionLoadingGate.svelte';
	import { diagnosis } from '$lib/features/medical-parameters/diagnosis/diagnosis-store.svelte';
	import { interleave } from '$lib/features/medical-parameters/diagnosis/interleave';
	import type {
		Finding,
		NarrativeClause,
		ParametersNarrative,
		RegionDiagnosis
	} from '$lib/features/medical-parameters/diagnosis/types';
	import type { Symptom } from '$lib/features/medical-parameters/diagnosis/conclusion';
	import type { Projection } from '$lib/features/dicom/types';

	let projection = $state<Projection>('side');
	const expandedRegions = new SvelteSet<string>(['conclusion']);
	const expandedItems = new SvelteSet<string>();

	const lang = $derived<LocaleKey>($locale === 'ru-RU' ? 'ru-RU' : 'en-US');
	const currentDiagnosis = $derived(projection === 'side' ? diagnosis.side : diagnosis.frontal);

	function localize(record: Record<LocaleKey, string>): string {
		return record[lang];
	}

	function isExpanded(regionId: string): boolean {
		return expandedRegions.has(regionId);
	}

	function toggleRegion(regionId: string) {
		if (expandedRegions.has(regionId)) expandedRegions.delete(regionId);
		else expandedRegions.add(regionId);
	}

	function isItemExpanded(itemKey: string): boolean {
		return expandedItems.has(itemKey);
	}

	function toggleItem(itemKey: string) {
		if (expandedItems.has(itemKey)) expandedItems.delete(itemKey);
		else expandedItems.add(itemKey);
	}

	/** Flattens the (at most one-level-deep) region/sub-region tree into a flat
	 * list — used for expand-all/collapse-all bookkeeping, which doesn't care
	 * about nesting. */
	function flattenRegions(regions: RegionDiagnosis[]): RegionDiagnosis[] {
		const out: RegionDiagnosis[] = [];
		for (const r of regions) {
			out.push(r);
			if (r.subRegions) out.push(...flattenRegions(r.subRegions));
		}
		return out;
	}

	/** Section ids managed by `expandedRegions` — every region/sub-region plus
	 * the standalone "conclusion" (Overall Assessment) section, so expand-all/
	 * collapse-all and the toggle button's "all expanded" check account for it
	 * too. */
	function allSectionIds(): string[] {
		return [...flattenRegions(currentDiagnosis.regions).map((r) => r.id), 'conclusion'];
	}

	function allItemKeys(): string[] {
		const keys: string[] = [];
		for (const region of flattenRegions(currentDiagnosis.regions)) {
			for (const row of interleave(region)) {
				keys.push(row.kind === 'vertebra' ? `v-${row.data.id}` : `g-${row.data.id}`);
			}
		}
		for (const d of currentDiagnosis.conclusionRanking) keys.push(d.key);
		return keys;
	}

	function expandAll() {
		expandedRegions.clear();
		allSectionIds().forEach((id) => expandedRegions.add(id));
		expandedItems.clear();
		allItemKeys().forEach((key) => expandedItems.add(key));
	}

	function collapseAll() {
		expandedRegions.clear();
		expandedItems.clear();
	}

	function scrollToId(anchorId: string) {
		requestAnimationFrame(() => {
			document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
	}

	/** `ancestorIds` is the chain of region ids to expand on the way to
	 * `anchorId` (e.g. `['thoracic', 'thoracic-upper']` for a vertebra inside
	 * the thoracic container's upper sub-region) — every id in the chain gets
	 * expanded, then the page scrolls to `anchorId`. */
	function goToSection(ancestorIds: string[], anchorId: string) {
		for (const id of ancestorIds) expandedRegions.add(id);
		if (!ancestorIds.includes(anchorId)) {
			expandedItems.add(anchorId);
		}
		scrollToId(anchorId);
	}

	function severityClasses(severity: Finding['severity']): string {
		switch (severity) {
			case 'grade1':
				return 'border-amber-400 bg-amber-400/10 text-amber-700';
			case 'grade2':
				return 'border-orange-500 bg-orange-500/10 text-orange-700';
			case 'grade3':
				return 'border-red-500 bg-red-500/10 text-red-700';
			case 'grade4':
				return 'border-red-700 bg-red-700/10 text-red-800';
			case 'grade5':
				return 'border-red-900 bg-red-900/10 text-red-900';
			default:
				return 'border-(--border) bg-(--muted)/30 text-(--muted-foreground)';
		}
	}

	/** Same red scale as severityClasses, plus green for 'normal' — used only
	 * for the inline per-parameter reference-range badges in the narrative,
	 * not the finding cards (which stay neutral gray for 'normal', unchanged). */
	function rangeBadgeClasses(severity: Finding['severity']): string {
		switch (severity) {
			case 'grade1':
				return 'bg-amber-400/15 text-amber-700';
			case 'grade2':
				return 'bg-orange-500/15 text-orange-700';
			case 'grade3':
				return 'bg-red-500/15 text-red-700';
			case 'grade4':
				return 'bg-red-700/15 text-red-800';
			case 'grade5':
				return 'bg-red-900/15 text-red-900';
			default:
				return 'bg-emerald-500/15 text-emerald-700';
		}
	}

	let busy = $state<null | 'pdf' | 'docx' | 'print'>(null);
	let exportError = $state(false);

	/** Opens the blank viewer tab synchronously, inside the click gesture, so
	 * pop-up blockers allow it — the PDF is streamed into it once built. DOCX
	 * downloads instead, so it needs no tab. */
	function startExport(kind: 'pdf' | 'docx' | 'print') {
		if (busy) return;
		let viewer: Window | null = null;
		if (kind !== 'docx') {
			viewer = window.open('', '_blank');
			viewer?.document.write($t('report.generating'));
		}
		void runExport(kind, viewer);
	}

	/** Builds the formal document (both projections, current UI locale) and
	 * hands it to the chosen client-side renderer. The report-export feature
	 * and its heavy pdfmake/docx deps are loaded on demand. PDF opens the blob
	 * in `viewer`; Print opens it and pre-opens the print dialog; DOCX downloads. */
	async function runExport(kind: 'pdf' | 'docx' | 'print', viewer: Window | null) {
		busy = kind;
		exportError = false;
		try {
			const ex = await import('$lib/features/report-export');
			const meta = ex.collectReportMeta(lang);
			const model = ex.buildReportDocModel({
				locale: lang,
				title: meta.title,
				generatedAtLine: meta.generatedAtLine,
				metaRows: meta.metaRows,
				disclaimer: meta.disclaimer,
				projections: [
					{ label: $t('side_projection'), data: diagnosis.side },
					{ label: $t('frontal_projection'), data: diagnosis.frontal }
				]
			});
			const headerText = `${$t('header.name')} — ${meta.title}`;
			if (kind === 'pdf') await ex.openPdf(model, headerText, viewer);
			else if (kind === 'docx') await ex.exportDocx(model, `${ex.reportFilename()}.docx`);
			else await ex.printPdf(model, headerText, viewer);
		} catch (err) {
			viewer?.close();
			console.error('report export failed', err);
			exportError = true;
		} finally {
			busy = null;
		}
	}
</script>

<SessionLoadingGate>
	<div class="mt-6 flex-1 outline-none">
		<div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<h2 class="text-2xl font-bold">{$t('report.header')}</h2>
			<div class="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-3">
				<div
					class="col-span-2 flex overflow-hidden rounded-lg border border-(--border) md:col-span-1"
				>
					<button
						class="flex flex-1 items-center justify-center px-3 py-1.5 text-center text-sm font-medium transition-colors {projection ===
						'side'
							? 'bg-(--primary) text-(--primary-foreground)'
							: 'text-(--muted-foreground) hover:bg-(--muted)'}"
						onclick={() => {
							projection = 'side';
						}}
					>
						{$t('side_projection')}
					</button>
					<button
						class="flex flex-1 items-center justify-center px-3 py-1.5 text-center text-sm font-medium transition-colors {projection ===
						'frontal'
							? 'bg-(--primary) text-(--primary-foreground)'
							: 'text-(--muted-foreground) hover:bg-(--muted)'}"
						onclick={() => {
							projection = 'frontal';
						}}
					>
						{$t('frontal_projection')}
					</button>
				</div>
				<button
					class="rounded-md border border-(--border) px-3 py-1.5 text-sm font-medium transition-colors hover:bg-(--accent)"
					onclick={() => {
						if (expandedRegions.size === allSectionIds().length) collapseAll();
						else expandAll();
					}}
				>
					{expandedRegions.size === allSectionIds().length
						? $t('report.collapse')
						: $t('report.expand')}
				</button>
				<div class="col-span-2 flex gap-2 md:col-span-1">
					<button
						onclick={() => startExport('pdf')}
						disabled={busy !== null}
						class="inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-md border border-(--border) bg-(--background) px-3 text-sm font-medium text-(--foreground) transition-colors hover:bg-(--accent) disabled:cursor-not-allowed disabled:opacity-50"
					>
						<img src={downloadSVG} alt="" class="h-4 w-4" />
						{busy === 'pdf' ? $t('report.generating') : 'PDF'}
					</button>
					<button
						onclick={() => startExport('docx')}
						disabled={busy !== null}
						class="inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-md border border-(--border) bg-(--background) px-3 text-sm font-medium text-(--foreground) transition-colors hover:bg-(--accent) disabled:cursor-not-allowed disabled:opacity-50"
					>
						<img src={documentSVG} alt="" class="h-4 w-4" />
						{busy === 'docx' ? $t('report.generating') : 'DOCX'}
					</button>
					<button
						onclick={() => startExport('print')}
						disabled={busy !== null}
						class="inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-md border border-(--border) bg-(--background) px-3 text-sm font-medium text-(--foreground) transition-colors hover:bg-(--accent) disabled:cursor-not-allowed disabled:opacity-50"
					>
						<img src={printSVG} alt="" class="h-4 w-4" />
						{busy === 'print' ? $t('report.generating') : $t('report.print')}
					</button>
				</div>
			</div>
		</div>

		{#if exportError}
			<p class="mb-4 text-sm text-(--destructive)">{$t('report.export_error')}</p>
		{/if}

		{#if currentDiagnosis.insufficientAnnotation}
			<div
				class="flex flex-col gap-6 rounded-xl border border-(--border) bg-(--card) p-6 text-(--card-foreground)"
			>
				<div class="py-8 text-center text-(--muted-foreground)">
					<img src={boneSVG} alt="bone icon" class="mx-auto mb-4 h-16 w-16 opacity-20" />
					<p>{$t('report.insufficient_annotation')}</p>
				</div>
			</div>
		{:else}
			<div class="flex flex-col gap-4 lg:flex-row">
				<div
					class="flex max-h-64 w-full flex-col gap-6 overflow-y-auto rounded-xl border border-(--border) bg-(--card) text-(--card-foreground) lg:max-h-none lg:w-64 lg:shrink-0"
				>
					<div class="sticky top-0 z-10 border-b border-(--border) bg-(--background) p-4">
						<h3 class="text-sm font-semibold">{$t('report.toc')}</h3>
					</div>
					<div class="p-2 pt-0">
						{#snippet tocEntry(region: RegionDiagnosis, chain: string[])}
							<div class="mb-2">
								<button
									class="w-full rounded px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-(--muted) {isExpanded(
										region.id
									)
										? 'bg-(--primary)/10 text-(--primary)'
										: ''}"
									onclick={() => goToSection(chain, region.id)}
								>
									{localize(region.label)}
								</button>
								{#if region.subRegions?.length}
									<div class="mt-1 ml-3 space-y-1">
										{#each region.subRegions as sub (sub.id)}
											{@render tocEntry(sub, [...chain, sub.id])}
										{/each}
									</div>
								{:else}
									<div class="mt-1 ml-3 space-y-0.5">
										{#each interleave(region) as row (row.kind + '-' + row.data.id)}
											{#if row.kind === 'vertebra'}
												<button
													class="block w-full px-2 py-1 text-left text-xs text-(--muted-foreground) hover:text-(--foreground)"
													onclick={() => goToSection(chain, `v-${row.data.id}`)}
												>
													{$t('vertebrae.head')}
													{row.data.id}
												</button>
											{:else}
												<button
													class="block w-full px-2 py-1 text-left text-xs text-(--muted-foreground) hover:text-(--foreground)"
													onclick={() => goToSection(chain, `g-${row.data.id}`)}
												>
													{$t('gaps.head')}
													{row.data.id}
												</button>
											{/if}
										{/each}
									</div>
								{/if}
							</div>
						{/snippet}
						{#each currentDiagnosis.regions as region (region.id)}
							{@render tocEntry(region, [region.id])}
						{/each}
						<div class="my-2 h-px w-full shrink-0 bg-(--border)"></div>
						<button
							class="w-full rounded px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-(--muted)"
							onclick={() => scrollToId('conclusion')}
						>
							{$t('report.header_overall')}
						</button>
					</div>
				</div>

				<div
					class="flex flex-1 flex-col gap-6 overflow-y-auto rounded-xl border border-(--border) bg-(--card) text-(--card-foreground)"
				>
					<div class="p-6">
						{#snippet clauseBadge(
							badge: NonNullable<NarrativeClause['badge']>,
							severity: Finding['severity']
						)}<span
								class="ml-1 rounded px-1.5 py-0.5 text-xs font-medium {rangeBadgeClasses(severity)}"
								>{localize(badge)}</span
							>{/snippet}
						{#snippet narrativeParagraph(narrative: ParametersNarrative, marginClass: string)}
							<p class="{marginClass} text-sm leading-relaxed">
								{#each narrative.clauses as clause, i (clause.key)}{localize(
										clause.text
									)}{#if clause.badge}{@render clauseBadge(clause.badge, clause.severity)}{/if}{i <
									narrative.clauses.length - 1
										? '; '
										: '.'}{/each}
							</p>
						{/snippet}

						{#snippet findingsList(findings: (Finding | Symptom)[], padding: string)}
							<div class="space-y-2">
								{#if findings.length > 0}
									{#each findings as finding, i (('id' in finding && finding.id) || i)}
										<div
											class="rounded border-l-4 {padding} text-sm {severityClasses(
												finding.severity
											)}"
										>
											{localize(finding.text)}
										</div>
									{/each}
								{:else}
									<div class="rounded border-l-4 {padding} text-sm {severityClasses('normal')}">
										{$t('report.no_anomalies')}
									</div>
								{/if}
							</div>
						{/snippet}

						{#snippet regionSection(region: RegionDiagnosis)}
							<div class="scroll-mt-20" id={region.id}>
								<button
									class="group mb-4 flex w-full items-center justify-between"
									onclick={() => toggleRegion(region.id)}
								>
									<div class="flex items-center gap-3">
										<img
											src={downSVG}
											alt="Expand/Collapse"
											class="h-4 w-4 transition-transform {isExpanded(region.id)
												? ''
												: '-rotate-90'}"
										/>
										<h3 class="text-xl font-bold">{localize(region.label)}</h3>
										<span
											class="inline-flex items-center justify-center rounded-md border border-(--border) px-2 py-0.5 text-xs font-medium"
										>
											{region.vertebraeLabel}
										</span>
									</div>
								</button>

								{#if isExpanded(region.id)}
									<div class="mb-4 ml-8">
										{@render narrativeParagraph(region.narrative, 'mb-3')}
									</div>
									{#if region.subRegions?.length}
										<div class="ml-8 space-y-8">
											{#each region.subRegions as sub (sub.id)}
												{@render regionSection(sub)}
											{/each}
										</div>
									{:else}
										<div class="ml-8 space-y-4">
											{#each interleave(region) as row (row.kind + '-' + row.data.id)}
												{#if row.kind === 'vertebra'}
													{@const itemKey = `v-${row.data.id}`}
													<div id={itemKey} class="scroll-mt-20">
														<button
															class="group mb-2 flex w-full items-center gap-2"
															onclick={() => toggleItem(itemKey)}
														>
															<img
																src={downSVG}
																alt="Expand/Collapse"
																class="h-3.5 w-3.5 transition-transform {isItemExpanded(itemKey)
																	? ''
																	: '-rotate-90'}"
															/>
															<h4 class="font-medium">{$t('vertebrae.head')} {row.data.id}</h4>
														</button>
														{#if isItemExpanded(itemKey)}
															<div class="ml-6">
																{@render narrativeParagraph(row.data.narrative, 'mb-2')}
															</div>
														{/if}
													</div>
												{:else}
													{@const itemKey = `g-${row.data.id}`}
													<div id={itemKey} class="scroll-mt-20">
														<button
															class="group mb-2 flex w-full items-center gap-2"
															onclick={() => toggleItem(itemKey)}
														>
															<img
																src={downSVG}
																alt="Expand/Collapse"
																class="h-3.5 w-3.5 transition-transform {isItemExpanded(itemKey)
																	? ''
																	: '-rotate-90'}"
															/>
															<h4 class="font-medium">{$t('gaps.head')} {row.data.id}</h4>
														</button>
														{#if isItemExpanded(itemKey)}
															<div class="ml-6">
																{@render narrativeParagraph(row.data.narrative, 'mb-2')}
															</div>
														{/if}
													</div>
												{/if}
											{/each}
										</div>
									{/if}
								{/if}
							</div>
						{/snippet}

						<div class="space-y-8 pb-8">
							{#each currentDiagnosis.regions as region (region.id)}
								{@render regionSection(region)}
							{/each}
						</div>

						<div class="my-2 h-px w-full shrink-0 bg-(--border)"></div>

						<div class="scroll-mt-20" id="conclusion">
							<button
								class="group mb-4 flex w-full items-center justify-between"
								onclick={() => toggleRegion('conclusion')}
							>
								<div class="flex items-center gap-3">
									<img
										src={downSVG}
										alt="Expand/Collapse"
										class="h-4 w-4 transition-transform {isExpanded('conclusion')
											? ''
											: '-rotate-90'}"
									/>
									<h3 class="text-xl font-bold">{$t('report.header_overall')}</h3>
								</div>
							</button>

							{#if isExpanded('conclusion')}
								<div class="ml-8">
									{#if currentDiagnosis.conclusionRanking.length === 0}
										<div class="rounded border-l-4 p-4 text-sm {severityClasses('normal')}">
											{$t('report.no_anomalies')}
										</div>
									{:else}
										<div class="space-y-3">
											{#each currentDiagnosis.conclusionRanking as d, i (d.key)}
												{@const pct = (d.probability * 100).toFixed(1)}
												<div
													class="rounded-lg border border-(--border) bg-(--card) p-3 {i === 0
														? 'border-l-4 border-l-(--primary)'
														: ''}"
												>
													<button
														class="group flex w-full items-center gap-2"
														onclick={() => toggleItem(d.key)}
													>
														<img
															src={downSVG}
															alt="Expand/Collapse"
															class="h-3.5 w-3.5 shrink-0 transition-transform {isItemExpanded(
																d.key
															)
																? ''
																: '-rotate-90'}"
														/>
														<span class="flex-1 text-left text-sm font-medium"
															>{localize(d.label)}</span
														>
														<span class="text-sm font-bold"
															>{localize(resolve_localized('report.probability', { pct }))}</span
														>
													</button>
													<div class="mt-2 ml-6 h-1.5 overflow-hidden rounded-full bg-(--muted)">
														<div
															class="h-full rounded-full bg-(--primary)"
															style="width: {pct}%"
														></div>
													</div>
													{#if isItemExpanded(d.key)}
														<div class="mt-3 ml-6">
															{@render findingsList(d.symptoms, 'p-2')}
														</div>
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						</div>

						<div class="my-2 h-px w-full shrink-0 bg-(--border)"></div>

						<div class="rounded bg-(--muted)/30 p-4 text-xs text-(--muted-foreground)">
							<p>{$t('report.disclaimer')}</p>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</SessionLoadingGate>
