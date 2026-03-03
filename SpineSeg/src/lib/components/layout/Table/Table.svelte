<script lang="ts">
	import type { TableContentType } from "$lib/components/layout/Table/Table.type";

    let { content = {head: [], rows: []}, projection = "side" }: {
        content: TableContentType,
        projection?: "side" | "frontal"
    } = $props();
</script>

<div class="flex items-center gap-2 mb-3">
    <span 
        class="inline-flex items-center justify-center rounded-md 
        border border-(--border) px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap 
        shrink-0 gap-1 focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 
        focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 
        dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) 
        transition-[color,box-shadow] overflow-hidden text-(--foreground)
        ">
        {#if projection == "side"}
            Lateral Projection
        {:else}
            Frontal Projection
        {/if}
    </span>
    <span class="text-sm text-(--muted-foreground)">3 vertebraes</span>
</div>
<div class="overflow-x-auto">
    <div class="relative w-full overflow-x-auto">
        <table class="w-full caption-bottom text-sm">
            <thead class="[&_tr]:border-b border-(--border)">
                <tr class="hover:bg-(--muted)/50 data-[state=selected]:bg-(--muted) border-b border-(--border) transition-colors">
                    {#each content.head as htd}
                        <th class="text-(--foreground) h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [[role=checkbox]]:translate-y-0.5">{ htd }</th>
                    {/each}
                </tr>
            </thead>
            <tbody class="[&_tr:last-child]:border-0">
                {#each content.rows as row}
                    <tr class="hover:bg-(--muted)/50 data-[state=selected]:bg-(--muted) border-b border-(--border) transition-colors">
                        {#each row as cell, i}
                            <td class:font-medium={ i == 0 } class="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [[role=checkbox]]:translate-y-0.5">{ cell }</td>
                        {/each}
                    </tr> 
                {/each}
            </tbody>
        </table>
    </div>
</div>