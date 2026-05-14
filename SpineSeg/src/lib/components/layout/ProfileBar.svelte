<script lang="ts">
    import leaveIcon from '$lib/assets/icons/leave.svg';
    import personIcon from '$lib/assets/icons/user.svg';

    import { t } from 'svelte-i18n';

	import { researcherService } from '$lib/core/session/researcher.svelte';
</script>

<div class="flex items-center gap-4 min-w-0"> 
    <div class="flex items-center gap-3 rounded-lg px-4 py-2 border border-(--border) min-w-0 flex-1"> 
        <div class="shrink-0 flex items-center justify-center w-9 h-9 bg-(--muted) rounded-full">
            <img src={ personIcon } class="w-6 h-6 opacity-50" alt="user"/>
        </div>

        <div class="flex flex-col min-w-0"> 
            <p class="text-sm font-medium text-gray-900 truncate">
                { researcherService.fullName }
            </p>
            <p class="text-xs text-gray-500 whitespace-nowrap">
                { researcherService.duty }
            </p>
        </div>
    </div>

    <button class="shrink-0 inline-flex cursor-pointer border border-(--border) items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_img]:pointer-events-none [&_img:not([class*='size-'])]:size-4 shrink-0 [&_img]:shrink-0 outline-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) bg-(--background) text-(--foreground) hover:bg-(--accent) hover:text-(--accent-foreground) h-8 rounded-md gap-1.5 px-3 has-[>img]:px-2.5">
        <img src={ leaveIcon } class="w-4 h-4" alt="leave"/> 
        <span class="hidden sm:block">
            { $t('header.logout') }
        </span>
    </button>
</div>