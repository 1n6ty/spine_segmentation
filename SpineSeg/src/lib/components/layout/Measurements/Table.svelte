<script lang="ts">
	import type { TableContentType, TableStructures } from "$lib/components/layout/Measurements/Table.type";
	import { t } from "svelte-i18n";

    let { content = {head: [], rows: []}, projection = "side", struct = "vertebra" }: {
        content: TableContentType,
        projection?: "side" | "frontal",
        struct?: TableStructures
    } = $props();

    let struct_form = $derived((() => {
        let base = `${struct}.`;

        if ((content.rows.length % 100) > 10 && (content.rows.length % 100) < 15) {
            base += "plural_2";
        } else if (((content.rows.length % 10) > 4 && (content.rows.length % 10) < 10) || ((content.rows.length % 10) == 0)) {
            base += "plural_2";
        } else if ((content.rows.length % 10) > 1 && (content.rows.length % 10) < 5) {
            base += "plural_1";
        } else {
            base += "one";
        }

        return base;
    })()),
        struct_head = $derived(struct + ".head");

    let linearHead = $derived(content.head.filter(e => { return e.type == "linear";})),
        angularHead = $derived(content.head.filter(e => { return e.type == "angular";}));
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
            { $t('side_projection') }
        {:else}
            { $t('frontal_projection') }
        {/if}
    </span>
    <span class="text-sm text-(--muted-foreground)">{ content.rows.length } { $t(struct_form) }</span>
</div>
<div class="overflow-x-auto">
    <div class="relative w-full overflow-x-auto">
        <table class="w-full caption-bottom text-sm">
            <thead class="[&_tr]:border-b border-(--border)">
                <tr class="hover:bg-(--muted)/50 data-[state=selected]:bg-(--muted) border-b border-(--border) transition-colors">
                    <th rowspan="2" class="text-(--foreground) h-10 px-2 text-center font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] align-middle border-(--border) border-r">{ $t(struct_head) }</th>
                    <th colspan="{ linearHead.length }" class="text-(--foreground) h-10 px-2 text-center font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] align-middle border-(--border) border-r">{ $t("parameters.linear") }</th>
                    <th colspan="{ angularHead.length }" class="text-(--foreground) h-10 px-2 text-center font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] align-middle border-(--border) border-r">{ $t("parameters.angular") }</th>
                    <th rowspan="2" class="text-(--foreground) h-10 px-2 text-center font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] align-middle border-(--border) border-r">{ $t('parameters.observation') }</th>
                </tr>
                <tr class="hover:bg-(--muted)/50 data-[state=selected]:bg-(--muted) border-(--border) border-b transition-colors bg-(--muted)/50">
                    {#each linearHead as lh}
                        <th class="text-(--foreground) py-2 px-2 text-left align-middle font-medium whitespace-normal text-xs border-(--border) border-r max-w-[150px]">
                            <div class="text-[10px] text-(--muted-foreground) font-normal mt-0.5">
                                { lh.name }
                            </div>
                        </th>
                    {/each}
                    {#each angularHead as ah}
                        <th class="text-(--foreground) py-2 px-2 text-left align-middle font-medium whitespace-normal text-xs border-(--border) border-r max-w-[150px]">
                            <div class="text-[10px] text-(--muted-foreground) font-normal mt-0.5">
                                { ah.name }
                            </div>
                        </th>
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