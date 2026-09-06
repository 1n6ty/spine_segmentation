<script lang="ts">
	import favicon from '$lib/assets/icons/favicon.svg';

	import { t } from 'svelte-i18n';
	import { page } from '$app/state';
	import ProfileBar from '$lib/components/ui/ProfileBar.svelte';
</script>

<header class="min-w-0 border-b border-(--border)">
	<div class="container mx-auto px-4 py-4">
		<div class="flex items-center justify-between">
			<a href={`/${page.params.lang}`} class="mr-4 flex items-center">
				<img src={favicon} class="mr-4 h-10 w-10 shrink-0" alt="favicon" />
				<div class="mr-4 hidden min-w-0 sm:block">
					<h1 class="text-3xl font-bold">Spine Segmentation</h1>
					<p class="text-sm text-(--muted-foreground)">
						{$t('header.p')}
					</p>
				</div>
			</a>
			<ProfileBar />
		</div>
	</div>
</header>
