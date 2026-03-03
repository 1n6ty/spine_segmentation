<script lang="ts">
    import { t } from "svelte-i18n";

    let { type = "zoom-in", callback, disabled = false, children }: {
            type: "zoom-in" | "zoom-out" | "full-screen" | "add-polygon" | "delete-polygon" | "cancel";
            callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }) => void;
            disabled?: boolean,
            children?: any
        } = $props();
    
    import ZoomIn from "$lib/assets/zoom-in.png";
    import ZoomOut from "$lib/assets/zoom-out.png";
    import FullScreen from "$lib/assets/full-screen.png";
    import AddBtn from "$lib/assets/plus.png";
    import DeleteBtn from "$lib/assets/delete.png";
    import CloseBtn from "$lib/assets/close.png";

    const mapTypeToIcon: Record<string, Record<string, string>> = {
        "zoom-in": {
            "src": ZoomIn,
            "alt": $t("editor.projection.zoom-in")
        },
        "zoom-out": {
            "src": ZoomOut,
            "alt": $t("editor.projection.zoom-out")
        },
        "full-screen": {
            "src": FullScreen,
            "alt": $t("editor.projection.full-screen")
        },
        "add-polygon": {
            "src": AddBtn,
            "alt": $t("editor.projection.add-polygon")
        },
        "delete-polygon": {
            "src": DeleteBtn,
            "alt": $t("editor.projection.delete-polygon")
        },
        "cancel": {
            "src": CloseBtn,
            "alt": $t("editor.projection.close")
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
    <img {...mapTypeToIcon[type]} />
    {#if children}
        {@render children()}
    {/if}
</button>