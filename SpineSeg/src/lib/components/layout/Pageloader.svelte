<script lang="ts">
    import { t, locale } from "svelte-i18n";

    const loadings: Record<string, string> = {
        en: "Loading",
        ru: "Загрузка"
    } as const;

    let { progress = 100, title = loadings[$locale && $locale in loadings ? $locale: 'en'] } = $props();

</script>

<div class="fixed inset-0 bg-(--background)/80 backdrop-blur-sm z-50 flex items-center justify-center">
    <div class="bg-(--card) border border-(--border) rounded-lg p-8 shadow-lg max-w-md w-full mx-4">
    <div class="flex flex-col items-center">
        <div class="loader bg-cover bg-center w-16 h-16"></div>

        <h3 class="text-xl font-semibold mb-2">{ title }...</h3>
        
        <div class="w-full mb-4">
            <div class="flex justify-between text-sm text-(--muted-foreground) mb-1">
            <span>{ $t('pageloader.progress') }</span>
            <span>{ progress }%</span>
            </div>
            <div class="w-full bg-(--secondary) rounded-full h-2 overflow-hidden">
            <div class="h-full bg-(--primary) transition-[width] duration-300"
                style="width: { progress }%;">
            </div>
            </div>
        </div>

        <div class="flex gap-2">
            {#each [0, 1, 2] as i}
                <div
                class="dot"
                style="animation-delay: {i * 0.2}s"
                ></div>
            {/each}
        </div>
    </div>
    </div>
</div>

<style>
  .loader {
    background-image: url('$lib/assets/icons/loader.svg');
  }

  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 9999px;
    background-color: var(--color-primary, currentColor);
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.5);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 0.5;
    }
  }
</style>