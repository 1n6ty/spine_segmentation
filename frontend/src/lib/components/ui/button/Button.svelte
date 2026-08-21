<script lang="ts">
	import { t } from 'svelte-i18n';

	let {
		type = 'add',
		callback = (e) => {},
		disabled = false,
		active = false,
		shortcut,
		children
	}: {
		type: ButtonType;
		callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => void;
		disabled?: boolean;
		active?: boolean;
		/** Keyboard shortcut hint appended to the button's title tooltip, e.g. "V" -> "Select (V)". */
		shortcut?: string;
		children?: any;
	} = $props();

	import ZoomIn from '$lib/assets/icons/zoom-in.svg';
	import ZoomOut from '$lib/assets/icons/zoom-out.svg';
	import AddBtn from '$lib/assets/icons/add.svg';
	import DeleteBtn from '$lib/assets/icons/delete.svg';
	import CancelBtn from '$lib/assets/icons/cancel.svg';
	import BackBtn from '$lib/assets/icons/back.svg';
	import ForwardBtn from '$lib/assets/icons/forward.svg';
	import MagicBtn from '$lib/assets/icons/magic.svg';
	import SelectBtn from '$lib/assets/icons/select.svg';
	import PanBtn from '$lib/assets/icons/pan.svg';

	import type { ButtonType } from './Button.type';

	const mapTypeToIcon: Record<ButtonType, { src: string; alt: string }> = {
		'zoom-in': {
			src: ZoomIn,
			alt: $t('icons_alt.zoom-in')
		},
		'zoom-out': {
			src: ZoomOut,
			alt: $t('icons_alt.zoom-out')
		},
		add: {
			src: AddBtn,
			alt: $t('icons_alt.add')
		},
		delete: {
			src: DeleteBtn,
			alt: $t('icons_alt.delete')
		},
		cancel: {
			src: CancelBtn,
			alt: $t('icons_alt.cancel')
		},
		back: {
			src: BackBtn,
			alt: $t('icons_alt.back')
		},
		forward: {
			src: ForwardBtn,
			alt: $t('icons_alt.forward')
		},
		magic: {
			src: MagicBtn,
			alt: $t('icons_alt.magic')
		},
		select: {
			src: SelectBtn,
			alt: $t('icons_alt.select')
		},
		pan: {
			src: PanBtn,
			alt: $t('icons_alt.pan')
		}
	} as const;
</script>

<button
	{disabled}
	aria-pressed={active}
	class="
    inline-flex h-8 shrink-0 items-center
    justify-center gap-1.5 rounded-md
    border border-(--border) bg-(--background)
    px-3
    text-sm
    font-medium
    whitespace-nowrap text-(--foreground)
    transition-all outline-none
    not-disabled:cursor-pointer hover:bg-(--accent)
    hover:text-(--accent-foreground)
    focus-visible:border-(--ring)
    focus-visible:ring-[3px] focus-visible:ring-(--ring)/50
    disabled:pointer-events-none disabled:cursor-none
    disabled:opacity-50 has-[>img]:px-2.5
    aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 [&_img]:pointer-events-none [&_img]:shrink-0 [&_img:not([class*='size-'])]:size-4
    {active ? 'border-(--ring) bg-(--accent) text-(--accent-foreground)' : ''}
  "
	title={shortcut ? `${mapTypeToIcon[type].alt} (${shortcut})` : mapTypeToIcon[type].alt}
	onclick={(e) => {
		callback(e);
	}}
>
	<img {...mapTypeToIcon[type]} class="h-2 w-2" />
	{#if children}
		{@render children()}
	{/if}
</button>
