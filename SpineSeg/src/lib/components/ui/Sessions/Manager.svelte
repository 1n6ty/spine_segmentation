<script lang="ts">
    import timerSVG from "$lib/assets/icons/timer.svg";
    import plusSVG from "$lib/assets/icons/add.svg";
    import deleteSVG from "$lib/assets/icons/delete.svg";
    import leftSVG from '$lib/assets/icons/left.svg';
    import rightSVG from '$lib/assets/icons/right.svg';
	import Card from "./Card.svelte";
	import { project } from "$lib/core/project.svelte";
	import { registry } from "$lib/core/session/registry.svelte";
	import type { SessionValue } from "$lib/core/session/types";
	import { t } from "svelte-i18n";
	import { SessionService } from "$lib/core/session/session.svelte";

    let sessions = $state<SessionValue[]>([]);
    $effect(() => {
        sessions = Object.values(registry.sessionValues).sort((a, b) => b.lastAccessed - a.lastAccessed);
    });

    let currentIndex = $state(0);
    const cardWidth = 260; 
    const gap = 16;        

    let containerWidth = $state(0);
    let visibleCount = $derived(containerWidth > 0 ? containerWidth / (cardWidth + gap) : 1);
    const translateX = $derived(-(currentIndex * (cardWidth + gap)));

    function next() {
        // Prevent scrolling past the end
        if (currentIndex < sessions.length - visibleCount) {
            currentIndex++;
        }
    }

    function prev() {
        if (currentIndex > 0) {
            currentIndex--;
        }
    }

    function handleCreate(e: MouseEvent) {
        e.preventDefault();

        project.session.destroy();
        project.session = new SessionService(null);
    }

    function handleDeleteAll(e: MouseEvent) {
        e.preventDefault();

        project.session.destroy();
        project.session = new SessionService(null);

        registry.clearAll();
    }
</script>

<div class="text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-4 mb-4 relative bg-(--background)">
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
            <img src={ timerSVG } alt="timer" class="h-5 w-5"/>
            <h3 class="font-semibold text-lg">
                { $t('research.head') }
            </h3>
            <span class="inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-medium w-fit whitespace-nowrap shrink-0 focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 aria-invalid:border-(--destructive) transition-[color,box-shadow] overflow-hidden border-transparent bg-(--secondary) text-(--secondary-foreground) [a&]:hover:bg-(--secondary)/90 h-5 text-sm">
                { sessions.length }
            </span>
        </div>
        <div class="flex gap-2">
            <button disabled={ !Boolean(project.session.sessionUID) } onclick={ handleCreate } class="cursor-pointer inline-flex items-center justify-center whitespace-nowrap font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_img]:pointer-events-none [&_img:not([class*='size-'])]:size-4 shrink-0 [&_img]:shrink-0 outline-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 aria-invalid:border-(--destructive) bg-(--primary) text-(--primary-foreground) hover:bg-(--primary)/90 rounded-md px-3 has-[>img]:px-2.5 h-8 text-sm gap-1">
                <img src={plusSVG} alt="new session" class="h-4 w-4" style="filter: invert(100%) brightness(200%);"/>
                <p class="sm:inline hidden">{ $t('research.create_new') }</p>
            </button>
            <button onclick={ handleDeleteAll } class="cursor-pointer inline-flex items-center justify-center whitespace-nowrap font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_img]:pointer-events-none [&_img:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-(--ring) focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 aria-invalid:border-(--destructive) bg-(--destructive) text-white hover:bg-(--destructive)/90 focus-visible:ring-(--destructive)/20 h-8 text-sm rounded-md px-3 has-[>img]:px-2.5 gap-1">
                <img src={deleteSVG} class="h-4 w-4" style="filter: invert(100%) brightness(200%);" alt="Clear all sessions"/>
                <p class="sm:inline hidden">{ $t('research.delete_all') }</p>
            </button>
        </div>
    </div>
    {#if sessions.length > 0}
        <div class="relative px-2">
            <div class="flex items-center gap-2">
                <button 
                    onclick={prev}
                    disabled={currentIndex === 0}
                    class="z-10 cursor-pointer inline-flex items-center justify-center border border-(--border) bg-(--background) hover:bg-(--accent) rounded-md h-34 px-2 disabled:opacity-30"
                >
                    <img src={ leftSVG } alt="back" class="size-4" />
                </button>

                <div 
                    class="relative flex flex-1 overflow-hidden h-34 items-center"
                    bind:clientWidth={containerWidth}
                >
                    <div 
                        class="flex flex-row gap-4 transition-transform duration-500 ease-out" 
                        style="transform: translateX({translateX}px);"
                    >
                        {#each sessions as sessionValue, i}
                            <div style="width: {cardWidth}px;" class="shrink-0 h-full">
                                {#if i >= currentIndex - 1 && i <= currentIndex + visibleCount + 1}
                                    <Card 
                                        active={project.session?.sessionUID === sessionValue.sessionUID}  
                                        sessionUID={ sessionValue.sessionUID }
                                    />
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>

                <button 
                    onclick={next}
                    disabled={currentIndex >= sessions.length - visibleCount}
                    class="z-10 cursor-pointer inline-flex items-center justify-center border border-(--border) bg-(--background) hover:bg-(--accent) rounded-md h-34 px-2 disabled:opacity-30"
                >
                    <img src={ rightSVG } alt="forward" class="size-4" />
                </button>
            </div>
        </div>
    {/if}
</div>