<script lang="ts">
    import favicon from '$lib/assets/icons/favicon.svg';

    import { t } from 'svelte-i18n';
</script>

<header class="border-b border-(--border)">
    <div class="container mx-auto px-4 py-4">
        <div class="flex items-center gap-3">
            <img src={ favicon } class="w-10 h-10" alt="favicon"/>
            <div>
                <h1 class="text-3xl font-bold">Spine Segmentation</h1>
                <p class="text-sm text-(--muted-foreground)">
                    { $t('header.p') }
                </p>
            </div>
        </div>
    </div>
</header>