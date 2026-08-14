<script lang="ts">
	import { t } from 'svelte-i18n';
</script>

<footer class="mt-12 border-t border-(--border)">
	<div class="container mx-auto px-4 py-6">
		<div class="text-center text-sm text-(--muted-foreground)">
			<p>{$t('footer.p_up')}</p>
			<p class="mt-1">{$t('footer.p_down')}</p>
		</div>
	</div>
</footer>
