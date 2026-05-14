<script lang="ts">
    import favicon from '$lib/assets/icons/favicon.svg';

    import { t } from 'svelte-i18n';
	import ProfileBar from './ProfileBar.svelte';
</script>

<header class="border-b border-(--border) min-w-0">
    <div class="container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
            <div class="flex items-center mr-4">
                <img src={ favicon } class="w-10 h-10 shrink-0 mr-4" alt="favicon"/>
                <div class="hidden sm:block min-w-0 mr-4">
                    <h1 class="text-3xl font-bold">Spine Segmentation</h1>
                    <p class="text-sm text-(--muted-foreground)">
                        { $t('header.p') }
                    </p>
                </div>
            </div>
            <ProfileBar />
        </div>
    </div>
</header>