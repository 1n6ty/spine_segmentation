<script lang="ts">
	import { t, locale } from 'svelte-i18n';
	import { SvelteSet } from 'svelte/reactivity';
	import type { LocaleKey } from '$lib/core/i18n/types';

	import boneSVG from '$lib/assets/icons/bone.svg';
	import downSVG from '$lib/assets/icons/down.svg';
	import downloadSVG from '$lib/assets/icons/download.svg';
	import documentSVG from '$lib/assets/icons/document.svg';

	import { project } from '$lib/core/project.svelte';
	import { diagnosis } from '$lib/features/medical-parameters/diagnosis/diagnosis-store.svelte';
	import type {
		Finding,
		GapDiagnosis,
		RegionDiagnosis,
		VertebraDiagnosis
	} from '$lib/features/medical-parameters/diagnosis/types';
	import type { Projection } from '$lib/features/dicom/types';

	let projection = $state<Projection>('side');
	const expandedRegions = new SvelteSet<string>();
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

	function allItemKeys(): string[] {
		const keys: string[] = [];
		for (const region of currentDiagnosis.regions) {
			for (const row of interleave(region)) {
				keys.push(row.kind === 'vertebra' ? `v-${row.data.id}` : `g-${row.data.id}`);
			}
		}
		return keys;
	}

	function expandAll() {
		expandedRegions.clear();
		currentDiagnosis.regions.forEach((r) => expandedRegions.add(r.id));
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

	function goToSection(regionId: string, anchorId: string) {
		expandedRegions.add(regionId);
		// anchorId is the region's own id when navigating to the region heading itself
		// (no matching vertebra/gap item key to also expand in that case).
		if (anchorId !== regionId) {
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

	type RowItem =
		| { kind: 'vertebra'; data: VertebraDiagnosis }
		| { kind: 'gap'; data: GapDiagnosis };

	function interleave(region: RegionDiagnosis): RowItem[] {
		// region.vertebrae/.gaps are bottom-up (inferior->superior) — that order feeds the
		// calculators (sign conventions for angles assume it) and must stay untouched there.
		// Reversed here, display-only, so rows read top-to-bottom (e.g. cervical: C2...C7).
		const rows: RowItem[] = [];
		region.vertebrae.forEach((v, i) => {
			rows.push({ kind: 'vertebra', data: v });
			if (i < region.gaps.length) rows.push({ kind: 'gap', data: region.gaps[i] });
		});
		return rows.reverse();
	}
</script>

{#await project.session.loadingPromise then}
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
						if (expandedRegions.size === currentDiagnosis.regions.length) collapseAll();
						else expandAll();
					}}
				>
					{expandedRegions.size === currentDiagnosis.regions.length
						? $t('report.collapse')
						: $t('report.expand')}
				</button>
				<div class="col-span-2 flex gap-2 md:col-span-1">
					<button
						disabled
						class="inline-flex h-8 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-(--border) bg-(--background) px-3 text-sm font-medium text-(--foreground) opacity-50"
					>
						<img src={downloadSVG} alt="Download PDF" class="h-4 w-4" />
						PDF
					</button>
					<button
						disabled
						class="inline-flex h-8 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-(--border) bg-(--background) px-3 text-sm font-medium text-(--foreground) opacity-50"
					>
						<img src={documentSVG} alt="Download DOCX" class="h-4 w-4" />
						DOCX
					</button>
				</div>
			</div>
		</div>

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
						{#each currentDiagnosis.regions as region (region.id)}
							<div class="mb-2">
								<button
									class="w-full rounded px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-(--muted) {isExpanded(
										region.id
									)
										? 'bg-(--primary)/10 text-(--primary)'
										: ''}"
									onclick={() => goToSection(region.id, region.id)}
								>
									{localize(region.label)}
								</button>
								<div class="mt-1 ml-3 space-y-0.5">
									{#each interleave(region) as row (row.kind + '-' + row.data.id)}
										{#if row.kind === 'vertebra'}
											<button
												class="block w-full px-2 py-1 text-left text-xs text-(--muted-foreground) hover:text-(--foreground)"
												onclick={() => goToSection(region.id, `v-${row.data.id}`)}
											>
												{$t('vertebrae.head')}
												{row.data.id}
											</button>
										{:else}
											<button
												class="block w-full px-2 py-1 text-left text-xs text-(--muted-foreground) hover:text-(--foreground)"
												onclick={() => goToSection(region.id, `g-${row.data.id}`)}
											>
												{$t('gaps.head')}
												{row.data.id}
											</button>
										{/if}
									{/each}
								</div>
							</div>
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
						<div class="space-y-8 pb-8">
							{#each currentDiagnosis.regions as region (region.id)}
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
											<p class="mb-3 text-sm leading-relaxed">{localize(region.narrative)}</p>
											<div class="space-y-2">
												{#if region.findings.length > 0}
													{#each region.findings as finding (finding.id)}
														<div
															class="rounded border-l-4 p-3 text-sm {severityClasses(
																finding.severity
															)}"
														>
															{localize(finding.text)}
														</div>
													{/each}
												{:else}
													<div class="rounded border-l-4 p-3 text-sm {severityClasses('normal')}">
														{$t('report.no_anomalies')}
													</div>
												{/if}
											</div>
										</div>
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
																<p class="mb-2 text-sm leading-relaxed">
																	{localize(row.data.narrative)}
																</p>
																<div class="space-y-2">
																	{#if row.data.findings.length > 0}
																		{#each row.data.findings as finding (finding.id)}
																			<div
																				class="rounded border-l-4 p-2 text-sm {severityClasses(
																					finding.severity
																				)}"
																			>
																				{localize(finding.text)}
																			</div>
																		{/each}
																	{:else}
																		<div
																			class="rounded border-l-4 p-2 text-sm {severityClasses(
																				'normal'
																			)}"
																		>
																			{$t('report.no_anomalies')}
																		</div>
																	{/if}
																</div>
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
																<p class="mb-2 text-sm leading-relaxed">
																	{localize(row.data.narrative)}
																</p>
																<div class="space-y-2">
																	{#if row.data.findings.length > 0}
																		{#each row.data.findings as finding (finding.id)}
																			<div
																				class="rounded border-l-4 p-2 text-sm {severityClasses(
																					finding.severity
																				)}"
																			>
																				{localize(finding.text)}
																			</div>
																		{/each}
																	{:else}
																		<div
																			class="rounded border-l-4 p-2 text-sm {severityClasses(
																				'normal'
																			)}"
																		>
																			{$t('report.no_anomalies')}
																		</div>
																	{/if}
																</div>
															</div>
														{/if}
													</div>
												{/if}
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>

						<div class="my-2 h-px w-full shrink-0 bg-(--border)"></div>

						<div class="scroll-mt-20" id="conclusion">
							<div class="mb-4 flex items-center gap-3">
								<h3 class="text-xl font-bold">{$t('report.header_overall')}</h3>
							</div>
							<div class="space-y-4">
								{#each currentDiagnosis.conclusion as finding (finding.id)}
									<div class="rounded border-l-4 p-4 {severityClasses(finding.severity)}">
										<p class="text-sm leading-relaxed">{localize(finding.text)}</p>
									</div>
								{/each}
							</div>
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
{/await}
