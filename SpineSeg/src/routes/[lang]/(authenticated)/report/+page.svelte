<script lang="ts">
    import { t, locale } from "svelte-i18n";

    import downSVG from "$lib/assets/icons/down.svg";

    import downloadSVG from "$lib/assets/icons/download.svg";
    import documentSVG from "$lib/assets/icons/document.svg";

    
</script>

<div class="flex-1 outline-none mt-6">
    <div class="flex gap-4 h-[calc(100vh-12rem)]">
        <div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) w-64 shrink-0 overflow-y-auto">
            <div class="p-4 border-b border-(--border) sticky top-0 bg-(--background) z-10">
                <h3 class="font-semibold text-sm">
                    Оглавление
                </h3>
            </div>
            <div class="p-2 pt-0">
                <div class="mb-2">
                    <button class="w-full text-left px-3 py-2 rounded text-sm font-medium hover:bg-(--muted) transition-colors bg-(--primary)/10 text-(--primary)">
                        Отдел 1
                    </button>
                    <div class="ml-3 mt-1 space-y-0.5">
                        <div class="px-2 py-1 text-xs text-(--muted-foreground)">
                            Позвонок 1
                        </div>
                        <div class="px-2 py-1 text-xs text-(--muted-foreground)">
                            Позвонок 2
                        </div>
                        
                        <div class="px-2 py-1 text-xs text-(--muted-foreground)">
                            Диск 1-2
                        </div>
                    </div>
                    <button class="w-full text-left px-3 py-2 rounded text-sm font-medium hover:bg-(--muted) transition-colors">
                        Отдел 2
                    </button>
                </div>
                <div class="bg-(--border) shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px my-2" data-orientation="horizontal"></div>
                <button class="w-full text-left px-3 py-2 rounded text-sm font-medium hover:bg-(--muted) transition-colors">
                    Заключение
                </button>
            </div>
        </div>
        <div class="bg-(--card) text-(--card-foreground) flex flex-col gap-6 rounded-xl border border-(--border) flex-1 overflow-y-auto">
            <div class="p-6">
                <div class="flex items-center justify-between mb-6 pb-4 border-b border-(--border) sticky top-0 bg-(--background) z-10">
                    <div class="flex items-center gap-4">
                        <h2 class="text-2xl font-bold">Диагностический отчёт</h2>
                        <div class="flex items-center rounded-lg border border-(--border) overflow-hidden">
                            <button class="px-3 py-1.5 text-sm font-medium transition-colors bg-(--primary) text-(--primary-foreground)">
                                Сагиттальная
                            </button>
                            <button class="px-3 py-1.5 text-sm font-medium transition-colors hover:bg-(--muted) text-(--muted-foreground)">
                                Фронтальная
                            </button>
                        </div>
                        <div class="flex gap-2">
                            <button class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) border border-(--border) bg-(--background) text-(--foreground) hover:bg-(--accent) hover:text-(--accent-foreground) h-8 rounded-md px-3 has-[>svg]:px-2.5 gap-2">
                                <img src={ downloadSVG } alt="Download DOCX" class="w-4 h-4" />
                                PDF
                            </button>
                            <button class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) border border-(--border) bg-(--background) text-(--foreground) hover:bg-(--accent) hover:text-(--accent-foreground) h-8 rounded-md px-3 has-[>svg]:px-2.5 gap-2">
                                <img src={ documentSVG } alt="Download DOCX" class="w-4 h-4" />
                                DOCX
                            </button>
                        </div>
                    </div>
                </div>
                <div class="space-y-8 pb-8">
                    <div class="scroll-mt-20">
                        <button class="w-full flex items-center justify-between mb-4 group">
                            <div class="flex items-center gap-3">
                                <img src={ downSVG } alt="Expand/Collapse" class="w-4 h-4" />
                                <h3 class="text-xl font-bold">
                                    Отдел 1
                                </h3>
                                <span class="inline-flex items-center justify-center rounded-md border border-(--border) px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-(--destructive) transition-[color,box-shadow] overflow-hidden text-(--foreground) [a&]:hover:bg-(--accent) [a&]:hover:text-(--accent-foreground)">
                                    T1-T12
                                </span>
                            </div>
                        </button>
                        <div class="ml-8 space-y-6">
                            <div>
                                <div class="space-y-6">
                                    <button class="w-full flex items-center justify-between mb-2">
                                        <div class="flex items-center gap-2">
                                            <img src={ downSVG } alt="Expand/Collapse" class="w-4 h-4" />
                                            <h4>Позвонок 1</h4>
                                        </div>
                                    </button>
                                    <div class="ml-6 text-sm text-(--muted-foreground)">
                                        <p>Параметр 1 - значение с текстовым описанием</p>
                                        <p>Параметр 2 - значение с текстовым описанием</p>
                                    </div>

                                    <button class="w-full flex items-center justify-between mb-2">
                                        <div class="flex items-center gap-2">
                                            <img src={ downSVG } alt="Expand/Collapse" class="w-4 h-4" />
                                            <h4>Позвонок 2</h4>
                                        </div>
                                    </button>
                                    <div class="ml-6 text-sm text-(--muted-foreground)">
                                        <p>Параметр 1 - значение с текстовым описанием</p>
                                        <p>Параметр 2 - значение с текстовым описанием</p>
                                    </div>

                                    <button class="w-full flex items-center justify-between mb-2">
                                        <div class="flex items-center gap-2">
                                            <img src={ downSVG } alt="Expand/Collapse" class="w-4 h-4" />
                                            <h4>Диск 1-2</h4>
                                        </div>
                                    </button>
                                    <div class="ml-6 text-sm text-(--muted-foreground)">
                                        <p>Параметр 1 - значение с текстовым описанием</p>
                                        <p>Параметр 2 - значение с текстовым описанием</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="bg-(--border) shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px my-2" data-orientation="horizontal"></div>
                <div class="scroll-mt-20">
                    <div class="flex items-center gap-3 mb-4">
                        <h3 class="text-xl font-bold">
                            Диагностическое заключение
                        </h3>
                    </div>
                    <div class="space-y-4">
                        <div class="bg-(--primary)/5 border-l-4 border-(--primary) p-4 rounded">
                            <h4 class="font-bold text-lg mb-2">Заключение</h4>
                            <p class="text-sm leading-relaxed">Текст заключения</p>
                        </div>
                    </div>
                </div>
                <div class="bg-(--border) shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px my-2" data-orientation="horizontal"></div>
                <div class="text-xs text-(--muted-foreground) bg-(--muted)/30 p-4 rounded">
                    <p class="font-medium mb-1">
                        Отказ от ответственности
                    </p>
                    <p>
                        Данный отчёт сформирован автоматически на основе разметки рентгенографических снимков и предназначен исключительно для образовательных и скрининговых целей. Все выявленные изменения должны быть подтверждены квалифицированным врачом-рентгенологом или ортопедом. Данный инструмент не заменяет профессиональную медицинскую диагностику.
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>
