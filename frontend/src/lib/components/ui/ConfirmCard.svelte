<script lang="ts">
	import { t } from 'svelte-i18n';
	import Button from '$lib/components/ui/button/Button.svelte';
	import type { ButtonType } from '$lib/components/ui/button/Button.type';

	/**
	 * Reusable in-app confirm dialog -- styled like the loading/status overlay
	 * cards already used in the editor, deliberately not the native browser
	 * `confirm()` (no app styling, blocks the whole tab, can't be localized
	 * beyond the OS locale). Renders as an absolutely-positioned overlay, so
	 * the parent must be `position: relative` (or otherwise establish a
	 * positioning context) for it to cover the right area.
	 */
	let {
		message,
		continueLabel,
		continueButtonType = 'magic',
		cancelLabel,
		onCancel,
		onContinue
	}: {
		message: string;
		continueLabel: string;
		continueButtonType?: ButtonType;
		cancelLabel?: string;
		onCancel: () => void;
		onContinue: () => void;
	} = $props();
</script>

<div
	class="absolute inset-0 z-50 flex items-center justify-center bg-(--background)/50 backdrop-blur-sm"
>
	<div
		class="flex max-w-xs flex-col items-center gap-4 rounded-xl border border-(--border) bg-(--card) p-6 text-center text-(--card-foreground) shadow-lg"
	>
		<span class="text-sm font-medium">{message}</span>
		<div class="flex gap-2">
			<Button type="cancel" callback={onCancel}>{cancelLabel ?? $t('editor.cancel')}</Button>
			<Button type={continueButtonType} callback={onContinue}>{continueLabel}</Button>
		</div>
	</div>
</div>
