<script lang="ts">
	import { locale } from 'svelte-i18n';
	import type { LocaleKey } from '$lib/core/i18n/types';
	import { resolve_localized } from '$lib/core/i18n/resolve';
	import type { Projection } from '$lib/features/dicom/types';
	import { parametersConfig } from '$lib/features/medical-parameters/config';
	import { params } from '$lib/features/medical-parameters/parameters-store.svelte';
	import { t } from 'svelte-i18n';
	import { project } from '$lib/core/project.svelte';

	let {
		projection = 'side'
	}: {
		projection: Projection;
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
	}

	let rows = $derived.by(() => {
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

		return targetData
			.map((e) => {
				const roundedValues = orderedKeys.map((key) => {
					const pv = (e.params as Record<string, { val: number | string | null; type: string }>)[
						key
					];
					if (!pv || pv.val === null) return '';
					const valStr = typeof pv.val === 'number' ? Number(pv.val.toFixed(2)) : pv.val;
					return `${valStr} ${$t('units.' + pv.type)}`;
				});

				return [e.name, ...roundedValues];
			})
			.reverse();
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
						<th
							rowspan="2"
							class="h-10 border-r border-(--border) px-2 text-center align-middle font-medium whitespace-nowrap text-(--foreground) [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5"
							>{$t('parameters.observation')}</th
						>
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
							{#each row as cell, i}
								<td
									class:font-medium={i == 0}
									class="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [[role=checkbox]]:translate-y-0.5"
									>{cell}</td
								>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
