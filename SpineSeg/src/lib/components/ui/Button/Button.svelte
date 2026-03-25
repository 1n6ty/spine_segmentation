<script lang="ts">
    import { t } from "svelte-i18n";

    let { type = "add", callback = (e) => {}, disabled = false, children }: {
        type: ButtonType;
        callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }) => void;
        disabled?: boolean,
        children?: any
    } = $props();
    
    import ZoomIn from "$lib/assets/icons/zoom-in.svg";
    import ZoomOut from "$lib/assets/icons/zoom-out.svg";
    import AddBtn from "$lib/assets/icons/add.svg";
    import DeleteBtn from "$lib/assets/icons/delete.svg";
    import CancelBtn from "$lib/assets/icons/cancel.svg";
    import BackBtn from "$lib/assets/icons/back.svg";
    import ForwardBtn from "$lib/assets/icons/forward.svg";
    import MagicBtn from "$lib/assets/icons/magic.svg";

	import type { ButtonType } from "./Button.type";

    const mapTypeToIcon: Record<ButtonType, { src: string, alt: string }> = {
        "zoom-in": {
            "src": ZoomIn,
            "alt": $t("icons_alt.zoom-in")
        },
        "zoom-out": {
            "src": ZoomOut,
            "alt": $t("icons_alt.zoom-out")
        },
        "add": {
            "src": AddBtn,
            "alt": $t("icons_alt.add")
        },
        "delete": {
            "src": DeleteBtn,
            "alt": $t("icons_alt.delete")
        },
        "cancel": {
            "src": CancelBtn,
            "alt": $t("icons_alt.cancel")
        },
        "back": {
            "src": BackBtn,
            "alt": $t("icons_alt.back")
        },
        "forward": {
            "src": ForwardBtn,
            "alt": $t("icons_alt.forward")
        },
        "magic": {
            "src": MagicBtn,
            "alt": $t("icons_alt.magic")
        }
    } as const;
</script>

<button
  disabled={disabled}
  class="
    inline-flex items-center justify-center whitespace-nowrap
    text-sm font-medium transition-all
    disabled:pointer-events-none disabled:opacity-50 disabled:cursor-none
    not-disabled:cursor-pointer
    [&_img]:pointer-events-none
    [&_img:not([class*='size-'])]:size-4
    shrink-0 [&_img]:shrink-0
    outline-none focus-visible:border-(--ring)
    focus-visible:ring-(--ring)/50 focus-visible:ring-[3px]
    aria-invalid:ring-(--destructive)/20
    aria-invalid:border-(--destructive)
    border border-(--border)
    bg-(--background) text-(--foreground)
    hover:bg-(--accent) hover:text-(--accent-foreground)
    h-8 rounded-md gap-1.5 px-3 has-[>img]:px-2.5
  "
  title={mapTypeToIcon[type].alt}
  onclick={(e) => { callback(e) }}
>
    <img {...mapTypeToIcon[type]} class="w-2 h-2" />
    {#if children}
        {@render children()}
    {/if}
</button>