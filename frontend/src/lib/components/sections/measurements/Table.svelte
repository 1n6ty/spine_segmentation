<script lang="ts">
	import { locale } from 'svelte-i18n';
	import type { LocaleKey } from '$lib/core/i18n/types';
	import { resolve_localized } from '$lib/core/i18n/resolve';
	import type { Projection } from '$lib/features/dicom/types';
	import { parametersConfig } from '$lib/features/medical-parameters/config';
	import { params } from '$lib/features/medical-parameters/parameters-store.svelte';
	import { remove_segment, can_add_segment } from '$lib/features/medical-parameters/segments';
	import { t } from 'svelte-i18n';
	import { project } from '$lib/core/project.svelte';
	import addSVG from '$lib/assets/icons/add.svg';
	import deleteSVG from '$lib/assets/icons/delete.svg';

	let {
		projection = 'side',
		onAddSegment = () => {}
	}: {
		projection: Projection;
		onAddSegment?: (projection: Projection) => void;
	} = $props();

	let head = $derived.by(() => {
		const currentProjectionConfig = parametersConfig[projection];
		const activeKey = params.activeStructure as keyof typeof currentProjectionConfig;
		const currentLocale = ($locale || 'en-US') as LocaleKey;
		const configEntries = currentProjectionConfig[activeKey];

		const result: Record<string, { name: string; type: string }> = {};
		for (const key of Object.keys(configEntries) as (keyof typeof configEntries)[]) {
			const entry = configEntries[key];
			const name = resolve_localized(
				`diagnosis.parameterNames.${projection}.${activeKey}.${String(key)}`
			)[currentLocale];
			result[key as string] = { name, type: entry.type };
		}
		return result;
	});

	interface ParameterRow {
		name: string;
		params: Record<string, { val: number | string; type: string }>;
		definitionId?: string;
	}

	interface Row {
		cells: string[];
		definitionId?: string;
	}

	let isSegments = $derived(params.activeStructure === 'segments');
	let canAddSegment = $derived(can_add_segment(projection));

	let rows = $derived.by((): Row[] => {
		$inspect(project.session.projections[projection].polygons);
		const currentProjection = params[projection];

		type ValidKeys = Exclude<keyof typeof currentProjection, 'overall'>;
		const activeKey = params.activeStructure as ValidKeys;
		const targetData = currentProjection[activeKey] as unknown as ParameterRow[];

		if (!targetData) return [];

		// Values must be ordered the same way the headers are grouped below (linear columns
		// first, then angular), using `head`'s own type declarations as the single source of
		// truth for that order — otherwise a parameter's value lands under the wrong header's
		// column the moment the type sequence isn't already a contiguous linear-then-angular
		// run (true for `gaps` and `overall`, not `vertebrae`/`segments`).
		const orderedKeys = [
			...Object.entries(head)
				.filter(([, h]) => h.type === 'linear')
				.map(([k]) => k),
			...Object.entries(head)
				.filter(([, h]) => h.type === 'angular')
				.map(([k]) => k)
		];

		const mapped = targetData.map((e) => {
			const roundedValues = orderedKeys.map((key) => {
				const pv = (e.params as Record<string, { val: number | string | null; type: string }>)[key];
				if (!pv || pv.val === null) return '';
				const valStr = typeof pv.val === 'number' ? Number(pv.val.toFixed(2)) : pv.val;
				return `${valStr} ${$t('units.' + pv.type)}`;
			});

			return { cells: [e.name, ...roundedValues], definitionId: e.definitionId };
		});

		// Segments already come pre-sorted anatomically (superior first) from the store, and
		// that sorted order IS the intended display order (per the requirement's example:
		// "C2–C6, then C4–Th2, then Th4–Th12") — so, unlike vertebrae/gaps, segments are not
		// reversed.
		return isSegments ? mapped : mapped.reverse();
	});

	let struct_form = $derived(
			(() => {
				let base = `${params.activeStructure}.`;

				if (rows.length % 100 > 10 && rows.length % 100 < 15) {
					base += 'plural_2';
				} else if ((rows.length % 10 > 4 && rows.length % 10 < 10) || rows.length % 10 == 0) {
					base += 'plural_2';
				} else if (rows.length % 10 > 1 && rows.length % 10 < 5) {
					base += 'plural_1';
				} else {
					base += 'one';
				}

				return base;
			})()
		),
		struct_head = $derived(params.activeStructure + '.head');

	let linearHead = $derived(
			Object.values(head).filter((e) => {
				return e.type == 'linear';
			})
		),
		angularHead = $derived(
			Object.values(head).filter((e) => {
				return e.type == 'angular';
			})
		);

	let totalColumns = $derived(
		1 + linearHead.length + angularHead.length + (isSegments ? 2 : 0)
	);
</script>

<div>
	<div class="mb-3 flex items-center gap-2">
		<span
			class="inline-flex w-fit shrink-0 items-center
            justify-center gap-1 overflow-hidden rounded-md border border-(--border) px-2 py-0.5
            text-xs font-medium whitespace-nowrap text-(--foreground)
            transition-[color,box-shadow] focus-visible:border-(--ring)
            focus-visible:ring-[3px] focus-visible:ring-(--ring)/50
            aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40
            "
		>
			{#if projection == 'side'}
				{$t('side_projection')}
			{:else}
				{$t('frontal_projection')}
			{/if}
		</span>
		<span class="text-sm text-(--muted-foreground)">{rows.length} {$t(struct_form)}</span>
	</div>
	<div class="overflow-x-auto">
		<div class="relative w-full overflow-x-auto">
			<table class="w-full caption-bottom text-sm">
				<thead class="border-(--border) [&_tr]:border-b">
					<tr
						class="border-b border-(--border) transition-colors hover:bg-(--muted)/50 data-[state=selected]:bg-(--muted)"
					>
						<th
							rowspan="2"
							class="h-10 border-r border-(--border) px-2 text-center align-middle font-medium whitespace-nowrap text-(--foreground) [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5"
							>{$t(struct_head)}</th
						>
						<th
							colspan={linearHead.length}
							class="h-10 border-r border-(--border) px-2 text-center align-middle font-medium whitespace-nowrap text-(--foreground) [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5"
							>{$t('parameters.linear')}</th
						>
						<th
							colspan={angularHead.length}
							class="h-10 border-r border-(--border) px-2 text-center align-middle font-medium whitespace-nowrap text-(--foreground) [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5"
							>{$t('parameters.angular')}</th
						>
						{#if isSegments}
							<th
								rowspan="2"
								class="h-10 px-2 text-center align-middle font-medium whitespace-nowrap text-(--foreground)"
							></th>
						{/if}
					</tr>
					<tr
						class="border-b border-(--border) bg-(--muted)/50 transition-colors hover:bg-(--muted)/50 data-[state=selected]:bg-(--muted)"
					>
						{#each linearHead as lh}
							<th
								class="max-w-37.5 border-r border-(--border) px-2 py-2 text-left align-middle text-xs font-medium whitespace-normal text-(--foreground)"
							>
								<div class="mt-0.5 text-[10px] font-normal text-(--muted-foreground)">
									{lh.name}
								</div>
							</th>
						{/each}
						{#each angularHead as ah}
							<th
								class="max-w-37.5 border-r border-(--border) px-2 py-2 text-left align-middle text-xs font-medium whitespace-normal text-(--foreground)"
							>
								<div class="mt-0.5 text-[10px] font-normal text-(--muted-foreground)">
									{ah.name}
								</div>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody class="[&_tr:last-child]:border-0">
					{#each rows as row}
						<tr
							class="border-b border-(--border) transition-colors hover:bg-(--muted)/50 data-[state=selected]:bg-(--muted)"
						>
							{#each row.cells as cell, i}
								<td
									class:font-medium={i == 0}
									class="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [[role=checkbox]]:translate-y-0.5"
									>{cell}</td
								>
							{/each}
							{#if isSegments}
								<td class="p-2 text-center align-middle whitespace-nowrap">
									<button
										onclick={() => row.definitionId && remove_segment(projection, row.definitionId)}
										class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md p-0 text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-(--accent) hover:text-(--accent-foreground) focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50 disabled:pointer-events-none disabled:opacity-50 has-[>img]:px-1.5 aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 [&_img]:pointer-events-none [&_img]:shrink-0"
									>
										<img
											src={deleteSVG}
											alt="Delete"
											class="h-4 w-4"
											style="filter: invert(26%) sepia(85%) saturate(2227%) hue-rotate(331deg) brightness(90%) contrast(105%);"
										/>
									</button>
								</td>
							{/if}
						</tr>
					{/each}
					{#if isSegments}
						<tr class="border-b border-(--border) transition-colors hover:bg-(--muted)/50">
							<td colspan={totalColumns} class="align-middle">
								<button
									onclick={() => onAddSegment(projection)}
									disabled={!canAddSegment}
									title={canAddSegment ? undefined : $t('segments.not_enough_vertebrae')}
									class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md p-2 text-sm font-medium whitespace-nowrap text-(--muted-foreground) transition-all outline-none hover:bg-(--accent) hover:text-(--accent-foreground) focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
								>
									<img src={addSVG} alt="Add" class="h-4 w-4" />
									{$t('segments.add')}
								</button>
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
