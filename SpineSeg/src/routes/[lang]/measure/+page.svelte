<script lang="ts">
	import Table from "$lib/components/layout/Measurements/Table.svelte";
	import type { TableStructures } from "$lib/components/layout/Measurements/Table.type";
	import { getParameters } from "$lib/features/medicalParameters/ParametersList";

	import { frontalStructureStore, sideStructureStore } from "$lib/stores/study/study.store";
    import { patientAndStudyExistsInStore } from "$lib/utils/patient";

    import OverallSpine from "$lib/components/layout/Measurements/OverallSpine.svelte";

    import boneSVG from "$lib/assets/icons/bone.svg";

    import { t, locale } from "svelte-i18n";

    const pagination: Record<string, { title: string, nav: string, code: TableStructures }[]> = {
        "ru": [
            {
                title: "Параметры позвонков",
                nav: "Позвонки",
                code: "vertebra"
            },
            {
                title: "Параметры межпозвонковых дисков",
                nav: "Диски",
                code: "disk"
            },
            {
                title: "Параметры стандартных и произвольных отделов",
                nav: "Отделы",
                code: "part"
            },
            {
                title: "Параметры позвоночника в целом",
                nav: "Позвоночник",
                code: "overall"
            }
        ],
        "en": [
            {
                title: "Vertebraes' parameters",
                nav: "Vertebraes",
                code: "vertebra"
            },
            {
                title: "Parameters of disks between vertebraes",
                nav: "Disks",
                code: "disk"
            },
            {
                title: "Parameters of standart and uncommon parts",
                nav: "Parts",
                code: "part"
            },
            {
                title: "Overall spine's parameters",
                nav: "Overall",
                code: "overall"
            }
        ]
    };

    let parametersList = $derived(getParameters($sideStructureStore, $frontalStructureStore));

    let activeIndex = $state(0);
    let activeStruct = $derived(pagination[$locale && $locale in pagination ? $locale: 'en'][activeIndex]);
</script>

<div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) p-6">
    {#if $patientAndStudyExistsInStore}
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold">{ $t('measure.header') }</h2>
            <div class="flex gap-2 overflow-x-auto px-1">
                {#each pagination[$locale && $locale in pagination ? $locale: 'en'] as p, i}
                    <button
                        onclick={(e) => { activeIndex = i; }}
                        class:bg-(--primary)={ activeIndex == i }
                        class:text-(--primary-foreground)={ activeIndex == i }
                        class="
                        cursor-pointer inline-flex items-center justify-center whitespace-nowrap text-sm
                        font-medium transition-all disabled:pointer-events-none disabled:opacity-50
                        shrink-0 outline-none border border-(--border) focus-visible:border-(--ring) focus-visible:ring-(--ring)/50
                        focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40
                        aria-invalid:border-(--destructive) hover:bg-(--primary)/90 hover:text-(--primary-foreground)
                        h-8 rounded-md px-3 my-1 gap-2
                        ">
                        { p.nav }
                    </button>
                {/each}
            </div>
        </div>
        <div
            data-orientation="horizontal"
            class="
                bg-(--border) shrink-0 data-[orientation=horizontal]:h-px
                data-[orientation=horizontal]:w-full mb-6
            ">
        </div>
        <div class="space-y-6">
            <div class="flex items-center gap-2 mb-4">
                <h3 class="text-lg font-semibold">{ pagination[$locale && $locale in pagination ? $locale: 'en'][activeIndex].title }</h3>
            </div>
            {#if pagination[$locale && $locale in pagination ? $locale: 'en'][activeIndex].code == "overall" }
                <OverallSpine parametersList={parametersList} pagination={pagination} />
            {:else}
                <div>
                    <Table
                        projection="side"
                        struct={ activeStruct.code }
                        content={
                            {
                                head: Object.values((parametersList.side as any)[activeStruct.code][$locale && $locale in pagination ? $locale: 'en']),
                                rows: Object.values(parametersList.side[activeStruct.code as keyof typeof parametersList.side].pl).map(e => {
                                    const roundedValues = Object.values(e.params).map(pv =>
                                        `${typeof pv.val === 'number' ? Number(pv.val.toFixed(2)) : pv.val} ${ $t('units.' + pv.type) }`
                                    );

                                    return [e.name, ...roundedValues];
                                }).reverse()
                            }
                        }
                    />
                </div>
                <div>
                    <Table
                        projection="frontal"
                        struct={ activeStruct.code }
                        content={
                            {
                                head: Object.values((parametersList.frontal as any)[activeStruct.code][$locale && $locale in pagination ? $locale: 'en']),
                                rows: Object.values(parametersList.frontal[activeStruct.code as keyof typeof parametersList.frontal].pl).map(e => {
                                    const roundedValues = Object.values(e.params).map(pv =>
                                        `${typeof pv.val === 'number' ? Number(pv.val.toFixed(2)) : pv.val} ${ $t('units.' + pv.type) }`
                                    );

                                    return [e.name, ...roundedValues];
                                }).reverse()
                            }
                        }
                    />
                </div>
            {/if}
        </div>
    {:else}
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold">{ $t('measure.header') }</h2>
        </div>
        <div class="text-center text-(--muted-foreground) py-8">
            <img src={boneSVG} alt="bone icon" class="w-16 h-16 mx-auto mb-4 opacity-20"/>
            <p>{ $t('no_file_loaded.p_up') }</p>
            <p class="text-sm mt-2">{ $t('no_file_loaded.p_down') }</p>
        </div>
    {/if}
</div>