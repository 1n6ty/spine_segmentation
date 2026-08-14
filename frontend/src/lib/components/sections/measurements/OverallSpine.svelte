<script lang="ts">
	import type { LocaleKey } from '$lib/core/i18n/types';
	import { resolve_localized } from '$lib/core/i18n/resolve';
	import { parametersConfig } from '$lib/features/medical-parameters/config';
	import { params } from '$lib/features/medical-parameters/parameters-store.svelte';
	import { locale, t } from 'svelte-i18n';

	type ParameterKey = keyof (typeof parametersConfig.side)['overall'];

	$: currentLocale = ($locale || 'en-US') as LocaleKey;

	function overall_config(projection: 'side' | 'frontal', key: ParameterKey) {
		const entry = parametersConfig[projection].overall[key];
		const name = resolve_localized(`diagnosis.parameterNames.${projection}.overall.${key}`)[
			currentLocale
		];
		return { name, type: entry.type };
	}
</script>

<div
	class="flex flex-col gap-6 rounded-xl border border-l-4 border-(--border) border-l-blue-500 bg-(--card) p-6 text-(--card-foreground)"
>
	<h4 class="mb-4 flex items-center gap-2 font-semibold">
		<span
			class="inline-flex w-fit shrink-0 items-center justify-center rounded-md border border-(--border) px-2 py-0.5 text-xs font-medium whitespace-nowrap text-(--foreground)"
		>
			{$t('side_projection')}
		</span>
	</h4>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
		{#each Object.keys(params.side.overall?.params || {}) as plKey}
			{@const key = plKey as ParameterKey}
			{@const config = overall_config('side', key)}
			{@const paramData = params.side.overall?.params?.[key]}

			{#if config && paramData && paramData.val !== null}
				<div class="rounded-lg bg-(--muted) p-4">
					<p class="mb-0.5 text-sm font-medium">{config.name}</p>
					<p class="text-lg font-semibold">
						{paramData.val.toFixed(2)}
						{$t(`units.${config.type}`)}
					</p>
				</div>
			{:else}
				<div class="rounded-lg bg-(--muted) p-4">
					<p class="mb-0.5 text-sm font-medium">{config.name}</p>
					<p class="text-lg font-semibold">
						{$t('not_enough')}
					</p>
				</div>
			{/if}
		{/each}
	</div>
</div>

<div
	class="flex flex-col gap-6 rounded-xl border border-l-4 border-(--border) border-l-blue-500 bg-(--card) p-6 text-(--card-foreground)"
>
	<h4 class="mb-4 flex items-center gap-2 font-semibold">
		<span
			class="inline-flex w-fit shrink-0 items-center justify-center rounded-md border border-(--border) px-2 py-0.5 text-xs font-medium whitespace-nowrap text-(--foreground)"
		>
			{$t('frontal_projection')}
		</span>
	</h4>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
		{#each Object.keys(params.frontal.overall?.params || {}) as plKey}
			{@const key = plKey as ParameterKey}
			{@const config = overall_config('frontal', key)}
			{@const paramData = params.frontal.overall?.params?.[key]}

			{#if config && paramData && paramData.val !== null}
				<div class="rounded-lg bg-(--muted) p-4">
					<p class="mb-0.5 text-sm font-medium">{config.name}</p>
					<p class="text-lg font-semibold">
						{paramData.val.toFixed(2)}
						{$t(`units.${config.type}`)}
					</p>
				</div>
			{:else}
				<div class="rounded-lg bg-(--muted) p-4">
					<p class="mb-0.5 text-sm font-medium">{config.name}</p>
					<p class="text-lg font-semibold">
						{$t('not_enough')}
					</p>
				</div>
			{/if}
		{/each}
	</div>
</div>
