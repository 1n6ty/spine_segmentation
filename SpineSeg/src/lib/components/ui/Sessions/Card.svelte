<script lang="ts">
	import { SessionService } from "$lib/core/session/session.svelte";
    import { t, locale } from "svelte-i18n";

    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import userSVG from "$lib/assets/icons/user.svg";
    import timerSVG from "$lib/assets/icons/timer.svg";
    import calendarSVG from '$lib/assets/icons/calendar.svg';
    import deleteSVG from "$lib/assets/icons/delete.svg";
	import { project } from "$lib/core/project.svelte";
	import { registry } from "$lib/core/session/registry.svelte";

    let { active = false, sessionUID }:
        { active: boolean, sessionUID: string } = $props();

    const session = $derived(registry.sessionValues[sessionUID]);

    let thumbUrl = $derived.by(() => {
        if (session?.thumbnail instanceof Blob) {
            return URL.createObjectURL(session.thumbnail);
        }
        return null;
    });

    $effect(() => {
        return () => {
            if (thumbUrl) URL.revokeObjectURL(thumbUrl);
        };
    });

    const dateTimeOptions = {
        year: "numeric",
        month: "long",
        day: "numeric",
    } as const;

    let now = $state(Date.now());
    $effect(() => {
        if(active) return;

        const interval = setInterval(() => now = Date.now(), 60000);
        return () => clearInterval(interval);
    });

    const timeAgo = $derived.by(() => {
        if(!session) return;

        const diff = (session.lastAccessed - now) / 1000;

        if (Math.abs(diff) < 60) return $t('units.time.now');
        if (Math.abs(diff) < 3600) return `${Math.floor(Math.abs(diff) / 60)}${$t('units.time.m')} ${$t('units.time.ago')}`;
        if (Math.abs(diff) < 86400) return `${Math.floor(Math.abs(diff) / 3600)}${$t('units.time.h')} ${$t('units.time.ago')}`;
        return `${Math.floor(Math.abs(diff) / 86400)}${$t('units.time.d')} ${$t('units.time.ago')}`;
    });

    function makeActive(e: MouseEvent) {
        console.log("Switching to session:", sessionUID);

        // 2. Cleanup current session properly
        if (project.session) {
            project.session.destroy();
        }

        // 3. Assign new session - this will trigger the $effect in the NEW active card
        project.session = new SessionService(sessionUID);

        const currentPath = page.url.pathname;
            
        // Check if path is exactly the locale (e.g., "/en" or "/en/")
        const isAtLocaleRoot = currentPath === `/${$locale}` || currentPath === `/${$locale}/`;

        if (isAtLocaleRoot) {
            goto(`/${$locale}/patient`);
        } else {
            console.log("Not at locale root, skipping navigation");
        }
    }

    async function handleDelete(e: MouseEvent) {
        e.stopPropagation();
        
        // 1. Clear project global if it's the one we are deleting
        if (active) {
            project.session.destroy();
            project.session = new SessionService(null);
        }

        // 2. Perform the registry delete
        await registry.delete(sessionUID);
    }
</script>

{#if session}
    {#if active}
        <div class="text-(--card-foreground) flex flex-col gap-6 rounded-xl p-2 cursor-pointer transition-all hover:shadow-md hover:border-(--primary) border-(--primary) border-2 bg-(--primary)/5">
            <div class="flex gap-2">
                <div class="relative bg-gray-900 rounded overflow-hidden w-16 h-26.5 shrink-0">
                    <img class="h-full object-cover mx-auto block" src={ thumbUrl } alt="Preview" />
                </div>
                <div class="flex-1 min-w-0 flex flex-col justify-between">
                    <div class="flex items-center justify-between gap-1">
                        <div class="flex items-center gap-1 flex-1 min-w-0">
                            <img src={ userSVG } alt="Patient" class="h-3 w-3"/>
                            <p class="text-xs font-semibold truncate">{ session.brief.patientName ?? $t('not_found') }</p>
                        </div>
                        <button onclick={(e) => { e.stopPropagation(); handleDelete(e); }} class="cursor-pointer flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_img]:pointer-events-none [&_img]:shrink-0 outline-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 aria-invalid:border-(--destructive) hover:bg-(--accent) hover:text-(--accent-foreground) rounded-md gap-1.5 has-[>img]:px-1.5 h-8 w-8 p-0 shrink-0">
                            <img src={ deleteSVG } alt="Delete" class="h-4 w-4" style="filter: invert(26%) sepia(85%) saturate(2227%) hue-rotate(331deg) brightness(90%) contrast(105%);" />
                        </button>
                    </div>
                    <div class="text-[10px] text-(--muted-foreground) truncate font-mono">
                        ID: { session.brief.patientUID ?? $t('not_found') }
                    </div>
                    <div class="flex items-center text-[9px]">
                        <span class="flex items-center gap-0.5 text-(--muted-foreground)">{ session.projections.side.hash ? 'LATERAL': '' } / { session.projections.frontal.hash ? 'FRONTAL': '' }</span>
                    </div>
                    <div class="flex items-center gap-1 text-[10px] text-(--muted-foreground)">
                        <img src={ calendarSVG } alt="Birthday" class="h-2.5 w-2.5" />
                        <span>{ session.brief.patientBirthdate?.toLocaleDateString($locale ?? undefined, dateTimeOptions) ?? $t('not_found') }</span>
                    </div>
                    <div class="mt-1 border-t">
                        <span class="inline-flex items-center rounded-md border border-(transparent) font-medium whitespace-nowrap shrink-0 bg-(--primary) text-(--primary-foreground) text-[9px] px-1.5 py-0 h-4 w-full justify-center">
                            ● { $t('research.active') }
                        </span>
                    </div>
                </div>
            </div>
        </div>
    {:else}
        <div onclick={makeActive} role="button" tabindex="0" class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-2 cursor-pointer transition-all hover:shadow-md hover:border-(--primary)">
            <div class="flex gap-2">
                <div class="relative bg-gray-900 rounded overflow-hidden w-16 h-26.5 shrink-0 overflow-hidden">
                    <img class="h-full object-cover mx-auto block" src={ thumbUrl } alt="Preview" />
                </div>
                <div class="flex-1 min-w-0 flex flex-col justify-between">
                    <div class="flex items-center justify-between gap-1">
                        <div class="flex items-center gap-1 flex-1 min-w-0">
                            <img src={ userSVG } alt="Patient" class="h-3 w-3"/>
                            <p class="text-xs font-semibold truncate">{ session.brief.patientName ?? $t('not_found') }</p>
                        </div>
                        <button onclick={(e) => { e.stopPropagation(); handleDelete(e); }} class="cursor-pointer flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_img]:pointer-events-none [&_img]:shrink-0 outline-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 aria-invalid:border-(--destructive) hover:bg-(--accent) hover:text-(--accent-foreground) rounded-md gap-1.5 has-[>img]:px-1.5 h-8 w-8 p-0 shrink-0">
                            <img src={ deleteSVG } alt="Delete" class="h-4 w-4" style="filter: invert(26%) sepia(85%) saturate(2227%) hue-rotate(331deg) brightness(90%) contrast(105%);" />
                        </button>
                    </div>
                    <div class="text-[10px] text-(--muted-foreground) truncate font-mono">
                        ID: { session.brief.patientUID ?? $t('not_found') }
                    </div>
                    <div class="flex items-center text-[9px]">
                        <span class="flex items-center gap-0.5 text-(--muted-foreground)">{ session.projections.side.hash ? 'LATERAL': '' } / { session.projections.frontal.hash ? 'FRONTAL': '' }</span>
                    </div>
                    <div class="flex items-center gap-1 text-[10px] text-(--muted-foreground)">
                        <img src={ calendarSVG } alt="Birthday" class="h-2.5 w-2.5" />
                        <span>{ session.brief.patientBirthdate?.toLocaleDateString($locale ?? undefined, dateTimeOptions) ?? $t('not_found') }</span>
                    </div>
                    <div class="flex items-center justify-between pt-1 border-t mt-1">
                        <span class="text-[10px] text-(--muted-foreground) flex items-center gap-0.5">
                            <img src={ timerSVG } alt="Last time accessed" class="h-2.5 w-2.5" />
                            { timeAgo }
                        </span>
                    </div>
                </div>
            </div>
        </div>
    {/if}
{/if}