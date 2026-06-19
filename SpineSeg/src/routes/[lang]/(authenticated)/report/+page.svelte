<script lang="ts">
    import { t, locale } from "svelte-i18n";
    import { supportedLocales } from "$lib/core/i18n/index.svelte";

    import boneSVG from "$lib/assets/icons/bone.svg";
    import downSVG from "$lib/assets/icons/down.svg";
    import downloadSVG from "$lib/assets/icons/download.svg";
    import documentSVG from "$lib/assets/icons/document.svg";

    import { project } from "$lib/core/project.svelte";
    import { diagnosis } from "$lib/features/medical-parameters/diagnosis/store.svelte";
    import type { Finding, GapDiagnosis, RegionDiagnosis, VertebraDiagnosis } from "$lib/features/medical-parameters/diagnosis/types";
    import type { Projection } from "$lib/features/dicom/types";

    type LocaleKey = (typeof supportedLocales)[number];

    let projection = $state<Projection>("side");
    let expandedRegions = $state<Set<string>>(new Set());
    let expandedItems = $state<Set<string>>(new Set());

    const lang = $derived<LocaleKey>($locale === "ru-RU" ? "ru-RU" : "en-US");
    const currentDiagnosis = $derived(projection === "side" ? diagnosis.side : diagnosis.frontal);

    function localize(record: Record<LocaleKey, string>): string {
        return record[lang];
    }

    function isExpanded(regionId: string): boolean {
        return expandedRegions.has(regionId);
    }

    function toggleRegion(regionId: string) {
        const next = new Set(expandedRegions);
        if (next.has(regionId)) next.delete(regionId);
        else next.add(regionId);
        expandedRegions = next;
    }

    function isItemExpanded(itemKey: string): boolean {
        return expandedItems.has(itemKey);
    }

    function toggleItem(itemKey: string) {
        const next = new Set(expandedItems);
        if (next.has(itemKey)) next.delete(itemKey);
        else next.add(itemKey);
        expandedItems = next;
    }

    function allItemKeys(): string[] {
        const keys: string[] = [];
        for (const region of currentDiagnosis.regions) {
            for (const row of interleave(region)) {
                keys.push(row.kind === "vertebra" ? `v-${row.data.id}` : `g-${row.data.id}`);
            }
        }
        return keys;
    }

    function expandAll() {
        expandedRegions = new Set(currentDiagnosis.regions.map((r) => r.id));
        expandedItems = new Set(allItemKeys());
    }

    function collapseAll() {
        expandedRegions = new Set();
        expandedItems = new Set();
    }

    function scrollToId(anchorId: string) {
        requestAnimationFrame(() => {
            document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

    function goToSection(regionId: string, anchorId: string) {
        if (!expandedRegions.has(regionId)) {
            expandedRegions = new Set(expandedRegions).add(regionId);
        }
        // anchorId is the region's own id when navigating to the region heading itself
        // (no matching vertebra/gap item key to also expand in that case).
        if (anchorId !== regionId && !expandedItems.has(anchorId)) {
            expandedItems = new Set(expandedItems).add(anchorId);
        }
        scrollToId(anchorId);
    }

    function severityClasses(severity: Finding["severity"]): string {
        switch (severity) {
            case "grade1":
                return "border-amber-400 bg-amber-400/10 text-amber-700";
            case "grade2":
                return "border-orange-500 bg-orange-500/10 text-orange-700";
            case "grade3":
                return "border-red-500 bg-red-500/10 text-red-700";
            case "grade4":
                return "border-red-700 bg-red-700/10 text-red-800";
            case "grade5":
                return "border-red-900 bg-red-900/10 text-red-900";
            default:
                return "border-(--border) bg-(--muted)/30 text-(--muted-foreground)";
        }
    }

    type RowItem = { kind: "vertebra"; data: VertebraDiagnosis } | { kind: "gap"; data: GapDiagnosis };

    function interleave(region: RegionDiagnosis): RowItem[] {
        // region.vertebras/.gaps are bottom-up (inferior->superior) — that order feeds the
        // calculators (sign conventions for angles assume it) and must stay untouched there.
        // Reversed here, display-only, so rows read top-to-bottom (e.g. cervical: C2...C7).
        const rows: RowItem[] = [];
        region.vertebras.forEach((v, i) => {
            rows.push({ kind: "vertebra", data: v });
            if (i < region.gaps.length) rows.push({ kind: "gap", data: region.gaps[i] });
        });
        return rows.reverse();
    }
</script>

{#await project.session.loadingPromise then}
{#if project.session.sessionUID}
<div class="flex-1 outline-none mt-6">
    <div class="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
        <h2 class="text-2xl font-bold">{ $t('report.header') }</h2>
        <div class="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-3">
            <div class="flex rounded-lg border border-(--border) overflow-hidden col-span-2 md:col-span-1">
                <button
                    class="flex-1 flex items-center justify-center px-3 py-1.5 text-sm font-medium text-center transition-colors {projection === 'side' ? 'bg-(--primary) text-(--primary-foreground)' : 'hover:bg-(--muted) text-(--muted-foreground)'}"
                    onclick={() => { projection = 'side'; }}>
                    { $t('side_projection') }
                </button>
                <button
                    class="flex-1 flex items-center justify-center px-3 py-1.5 text-sm font-medium text-center transition-colors {projection === 'frontal' ? 'bg-(--primary) text-(--primary-foreground)' : 'hover:bg-(--muted) text-(--muted-foreground)'}"
                    onclick={() => { projection = 'frontal'; }}>
                    { $t('frontal_projection') }
                </button>
            </div>
            <button
                class="px-3 py-1.5 text-sm font-medium rounded-md border border-(--border) hover:bg-(--accent) transition-colors"
                onclick={() => { if (expandedRegions.size === currentDiagnosis.regions.length) collapseAll(); else expandAll(); }}>
                { expandedRegions.size === currentDiagnosis.regions.length ? $t('report.collapse') : $t('report.expand') }
            </button>
            <div class="flex gap-2 col-span-2 md:col-span-1">
                <button disabled class="flex-1 inline-flex items-center justify-center gap-2 text-sm font-medium border border-(--border) bg-(--background) text-(--foreground) opacity-50 cursor-not-allowed h-8 rounded-md px-3">
                    <img src={ downloadSVG } alt="Download PDF" class="w-4 h-4" />
                    PDF
                </button>
                <button disabled class="flex-1 inline-flex items-center justify-center gap-2 text-sm font-medium border border-(--border) bg-(--background) text-(--foreground) opacity-50 cursor-not-allowed h-8 rounded-md px-3">
                    <img src={ documentSVG } alt="Download DOCX" class="w-4 h-4" />
                    DOCX
                </button>
            </div>
        </div>
    </div>

    {#if currentDiagnosis.insufficientAnnotation}
        <div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6">
            <div class="text-center text-(--muted-foreground) py-8">
                <img src={boneSVG} alt="bone icon" class="w-16 h-16 mx-auto mb-4 opacity-20"/>
                <p>{ $t('report.insufficient_annotation') }</p>
            </div>
        </div>
    {:else}
        <div class="flex flex-col lg:flex-row gap-4">
            <div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) w-full lg:w-64 lg:shrink-0 max-h-64 lg:max-h-none overflow-y-auto">
                <div class="p-4 border-b border-(--border) sticky top-0 bg-(--background) z-10">
                    <h3 class="font-semibold text-sm">{ $t('report.toc') }</h3>
                </div>
                <div class="p-2 pt-0">
                    {#each currentDiagnosis.regions as region (region.id)}
                        <div class="mb-2">
                            <button
                                class="w-full text-left px-3 py-2 rounded text-sm font-medium hover:bg-(--muted) transition-colors {isExpanded(region.id) ? 'bg-(--primary)/10 text-(--primary)' : ''}"
                                onclick={() => goToSection(region.id, region.id)}>
                                { localize(region.label) }
                            </button>
                            <div class="ml-3 mt-1 space-y-0.5">
                                {#each interleave(region) as row}
                                    {#if row.kind === 'vertebra'}
                                        <button class="block w-full text-left px-2 py-1 text-xs text-(--muted-foreground) hover:text-(--foreground)" onclick={() => goToSection(region.id, `v-${row.data.id}`)}>
                                            { $t('vertebras.head') } { row.data.id }
                                        </button>
                                    {:else}
                                        <button class="block w-full text-left px-2 py-1 text-xs text-(--muted-foreground) hover:text-(--foreground)" onclick={() => goToSection(region.id, `g-${row.data.id}`)}>
                                            { $t('gaps.head') } { row.data.id }
                                        </button>
                                    {/if}
                                {/each}
                            </div>
                        </div>
                    {/each}
                    <div class="bg-(--border) shrink-0 h-px w-full my-2"></div>
                    <button class="w-full text-left px-3 py-2 rounded text-sm font-medium hover:bg-(--muted) transition-colors" onclick={() => scrollToId('conclusion')}>
                        { $t('report.header_overall') }
                    </button>
                </div>
            </div>

            <div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) flex-1 overflow-y-auto">
                <div class="p-6">
                    <div class="space-y-8 pb-8">
                        {#each currentDiagnosis.regions as region (region.id)}
                            <div class="scroll-mt-20" id={region.id}>
                                <button class="w-full flex items-center justify-between mb-4 group" onclick={() => toggleRegion(region.id)}>
                                    <div class="flex items-center gap-3">
                                        <img src={ downSVG } alt="Expand/Collapse" class="w-4 h-4 transition-transform {isExpanded(region.id) ? '' : '-rotate-90'}" />
                                        <h3 class="text-xl font-bold">{ localize(region.label) }</h3>
                                        <span class="inline-flex items-center justify-center rounded-md border border-(--border) px-2 py-0.5 text-xs font-medium">
                                            { region.vertebraeLabel }
                                        </span>
                                    </div>
                                </button>

                                {#if isExpanded(region.id)}
                                    <div class="ml-8 mb-4">
                                        <p class="text-sm leading-relaxed mb-3">{ localize(region.narrative) }</p>
                                        <div class="space-y-2">
                                            {#if region.findings.length > 0}
                                                {#each region.findings as finding (finding.id)}
                                                    <div class="border-l-4 rounded p-3 text-sm {severityClasses(finding.severity)}">{ localize(finding.text) }</div>
                                                {/each}
                                            {:else}
                                                <div class="border-l-4 rounded p-3 text-sm {severityClasses('normal')}">{ $t('report.no_anomalies') }</div>
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="ml-8 space-y-4">
                                        {#each interleave(region) as row}
                                            {#if row.kind === 'vertebra'}
                                                {@const itemKey = `v-${row.data.id}`}
                                                <div id={itemKey} class="scroll-mt-20">
                                                    <button class="w-full flex items-center gap-2 mb-2 group" onclick={() => toggleItem(itemKey)}>
                                                        <img src={ downSVG } alt="Expand/Collapse" class="w-3.5 h-3.5 transition-transform {isItemExpanded(itemKey) ? '' : '-rotate-90'}" />
                                                        <h4 class="font-medium">{ $t('vertebras.head') } { row.data.id }</h4>
                                                    </button>
                                                    {#if isItemExpanded(itemKey)}
                                                        <div class="ml-6">
                                                            <p class="text-sm leading-relaxed mb-2">{ localize(row.data.narrative) }</p>
                                                            <div class="space-y-2">
                                                                {#if row.data.findings.length > 0}
                                                                    {#each row.data.findings as finding (finding.id)}
                                                                        <div class="border-l-4 rounded p-2 text-sm {severityClasses(finding.severity)}">{ localize(finding.text) }</div>
                                                                    {/each}
                                                                {:else}
                                                                    <div class="border-l-4 rounded p-2 text-sm {severityClasses('normal')}">{ $t('report.no_anomalies') }</div>
                                                                {/if}
                                                            </div>
                                                        </div>
                                                    {/if}
                                                </div>
                                            {:else}
                                                {@const itemKey = `g-${row.data.id}`}
                                                <div id={itemKey} class="scroll-mt-20">
                                                    <button class="w-full flex items-center gap-2 mb-2 group" onclick={() => toggleItem(itemKey)}>
                                                        <img src={ downSVG } alt="Expand/Collapse" class="w-3.5 h-3.5 transition-transform {isItemExpanded(itemKey) ? '' : '-rotate-90'}" />
                                                        <h4 class="font-medium">{ $t('gaps.head') } { row.data.id }</h4>
                                                    </button>
                                                    {#if isItemExpanded(itemKey)}
                                                        <div class="ml-6">
                                                            <p class="text-sm leading-relaxed mb-2">{ localize(row.data.narrative) }</p>
                                                            <div class="space-y-2">
                                                                {#if row.data.findings.length > 0}
                                                                    {#each row.data.findings as finding (finding.id)}
                                                                        <div class="border-l-4 rounded p-2 text-sm {severityClasses(finding.severity)}">{ localize(finding.text) }</div>
                                                                    {/each}
                                                                {:else}
                                                                    <div class="border-l-4 rounded p-2 text-sm {severityClasses('normal')}">{ $t('report.no_anomalies') }</div>
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

                    <div class="bg-(--border) shrink-0 h-px w-full my-2"></div>

                    <div class="scroll-mt-20" id="conclusion">
                        <div class="flex items-center gap-3 mb-4">
                            <h3 class="text-xl font-bold">{ $t('report.header_overall') }</h3>
                        </div>
                        <div class="space-y-4">
                            {#each currentDiagnosis.conclusion as finding (finding.id)}
                                <div class="border-l-4 rounded p-4 {severityClasses(finding.severity)}">
                                    <p class="text-sm leading-relaxed">{ localize(finding.text) }</p>
                                </div>
                            {/each}
                        </div>
                    </div>

                    <div class="bg-(--border) shrink-0 h-px w-full my-2"></div>

                    <div class="text-xs text-(--muted-foreground) bg-(--muted)/30 p-4 rounded">
                        <p>{ $t('report.disclaimer') }</p>
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>
{:else}
<div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6 mt-6">
    <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold">{ $t('report.header') }</h2>
    </div>
    <div class="text-center text-(--muted-foreground) py-8">
        <img src={boneSVG} alt="bone icon" class="w-16 h-16 mx-auto mb-4 opacity-20"/>
        <p>{ $t('no_file_loaded.p_up') }</p>
        <p class="text-sm mt-2">{ $t('no_file_loaded.p_down') }</p>
    </div>
</div>
{/if}
{/await}
