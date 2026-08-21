<script lang="ts">
	import { t } from 'svelte-i18n';

	import documentSVG from '$lib/assets/icons/document.svg';
	import boneSVG from '$lib/assets/icons/bone.svg';

	import PatientInfo from '$lib/components/sections/patient-info/PatientInfo.svelte';
	import { project } from '$lib/core/project.svelte';
</script>

{#if project.session.projections.side.patient || project.session.projections.frontal.patient}
	<div
		class="flex flex-col gap-6 rounded-xl border border-(--border) bg-(--card) p-6 text-(--card-foreground)"
	>
		<div class="mb-6 flex items-center justify-between">
			<h2 class="text-2xl font-bold">{$t('patient.title')}</h2>
			<span
				class="hidden w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-(--border) px-2 py-0.5 text-xs font-medium whitespace-nowrap text-(--foreground) transition-[color,box-shadow] focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--ring)/50 aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 sm:inline-flex dark:aria-invalid:ring-(--destructive)/40 [&>img]:pointer-events-none [&>img]:size-3 [a&]:hover:bg-(--accent) [a&]:hover:text-(--accent-foreground)"
			>
				<img src={documentSVG} alt="Document icon" class="h-4 w-4" />
				DICOM Metadata
			</span>
		</div>
		<PatientInfo />
		<div
			data-orientation="horizontal"
			class="my-6 shrink-0 bg-(--border) data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px"
		></div>
		<div class="rounded-lg bg-(--muted) p-4 text-sm text-(--muted-foreground)">
			<p class="mb-1 font-medium">{$t('patient.privacy_note.title')}</p>
			<p>{$t('patient.privacy_note.comment')}</p>
		</div>
	</div>
{:else}
	<div
		class="flex flex-col gap-6 rounded-xl border border-(--border) bg-(--card) p-6 text-(--card-foreground)"
	>
		<div class="mb-6 flex items-center justify-between">
			<h2 class="text-2xl font-bold">{$t('patient.title')}</h2>
		</div>
		<div class="py-8 text-center text-(--muted-foreground)">
			<img src={boneSVG} alt="bone icon" class="mx-auto mb-4 h-16 w-16 opacity-20" />
			<p>{$t('no_file_loaded.p_up')}</p>
			<p class="mt-2 text-sm">{$t('no_file_loaded.p_down')}</p>
		</div>
	</div>
{/if}
