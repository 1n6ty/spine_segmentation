<script lang="ts">
	import { t, locale } from 'svelte-i18n';

	import acceptedSVG from '$lib/assets/icons/accepted.svg';
	import documentSVG from '$lib/assets/icons/document.svg';
	import againSVG from '$lib/assets/icons/again.svg';
	import type { UploadBtnType } from '$lib/components/ui/dicom-upload-card/DicomUploadCard.type';

	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { supportedLocales } from '$lib/core/i18n/index.svelte';
	import { project } from '$lib/core/project.svelte';
	import { research_url } from '$lib/shared/utils/routing';
	import type { Projection } from '$lib/features/dicom/types';
	import LoadingOverlay from '$lib/components/ui/LoadingOverlay.svelte';

	let fileInput: HTMLInputElement;
	let currentProjection: 'frontal' | 'side';
	let uploadError = $state<string | null>(null);
	// The upload+parse round trip happens here, before navigating to the
	// research -- so the destination page's SessionLoadingGate can't cover it.
	let uploading = $state(false);

	const handleFileChange = async (event: Event) => {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		// Reset so a later successful upload can pick the same file again --
		// browsers don't fire `change` a second time for an unchanged selection.
		input.value = '';
		if (!file) return;

		uploadError = null;
		uploading = true;

		try {
			await project.session.uploadFile(file, currentProjection);
		} catch (err) {
			// Previously unhandled -- a rejected upload (e.g. an invalid file)
			// silently did nothing visible at all, with no indication anything
			// had even been attempted.
			uploadError = err instanceof Error ? err.message : String(err);
			return;
		} finally {
			uploading = false;
		}

		// Always navigate to this research's URL -- tracks it into the
		// browser history, whether this was the session's first upload
		// (from the bare landing page) or a second projection uploaded
		// while already viewing/editing it. Preserves whichever tab is
		// currently open.
		goto(research_url(page.params.lang!, project.session.sessionUID, page.url.pathname));
	};

	const openFileDialog = (projection: Projection) => {
		currentProjection = projection;
		fileInput.click();
	};

	const upload_projections: Record<(typeof supportedLocales)[number], UploadBtnType[]> = {
		'ru-RU': [
			{
				label: 'Сагиттальная проекция',
				projection: 'side',
				accepted: 'Файл сагиттальной проекции загружен',
				acceptedComment: 'Для загрузки нового файла необходимо очистить сессию или начать новую',
				btn: 'Загрузить DICOM файл сагиттальной проекции',
				id: 'side-dicom-upload',
				callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => {
					openFileDialog('side');
				}
			},
			{
				label: 'Фронтальная проекция',
				projection: 'frontal',
				accepted: 'Файл фронтальной проекции загружен',
				acceptedComment: 'Для загрузки нового файла необходимо очистить сессию или начать новую',
				btn: 'Загрузить DICOM файл фронтальной проекции',
				id: 'frontal-dicom-upload',
				callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => {
					openFileDialog('frontal');
				}
			}
		],
		'en-US': [
			{
				label: 'Lateral View',
				projection: 'side',
				accepted: 'Lateral view uploaded',
				acceptedComment: 'Clear or create new session to upload a new file',
				btn: 'Upload DICOM file of Lateral projection',
				id: 'side-dicom-upload',
				callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => {
					openFileDialog('side');
				}
			},
			{
				label: 'Frontal View',
				projection: 'frontal',
				accepted: 'Frontal view uploaded',
				acceptedComment: 'Clear or create new session to upload a new file',
				btn: 'Upload DICOM file of Frontal projection',
				id: 'frontal-dicom-upload',
				callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => {
					openFileDialog('frontal');
				}
			}
		]
	} as const;

	$effect(() => {
		const side = project.session.projections.side;
		const frontal = project.session.projections.frontal;

		// This log confirms the effect is tracking correctly
		console.log('State change detected, requesting save...');

		// Trigger your debounced save
		project.session.requestSave();
	});

	function handleClear(e: MouseEvent) {
		e.preventDefault();

		uploadError = null;
		project.registry.delete(project.session.sessionUID);
		project.resetSession();
	}
</script>

<input
	type="file"
	accept=".dcm,application/dicom"
	bind:this={fileInput}
	onchange={handleFileChange}
	class="hidden"
/>

{#if uploading}
	<LoadingOverlay label={$t('main.DICOM_upload_card.parsing')} />
{/if}

<div
	class="bg-card flex flex-col gap-6 rounded-xl border border-(--border) p-6 text-(--card-foreground)"
>
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-2xl font-bold">{$t('main.DICOM_upload_card.h2')}</h2>
		{#if project.session.projections.side.sopInstanceUid || project.session.projections.frontal.sopInstanceUid}
			<div class="flex items-end gap-2">
				<button
					onclick={handleClear}
					class="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md bg-(--destructive) px-3 text-sm font-medium whitespace-nowrap text-white transition-all outline-none hover:bg-(--destructive)/90 focus-visible:border-(--ring) focus-visible:ring-[3px] focus-visible:ring-(--destructive)/20 disabled:pointer-events-none disabled:opacity-50 has-[>img]:px-2.5 aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 [&_img]:pointer-events-none [&_img:not([class*='size-'])]:size-4 [&_svg]:shrink-0"
				>
					<img
						src={againSVG}
						style="filter: invert(100%) brightness(200%);"
						alt="Clear the session"
					/>
					<p class="hidden sm:inline">{$t('main.DICOM_upload_card.clear_session')}</p>
				</button>
			</div>
		{/if}
	</div>
	{#if uploadError}
		<div
			class="mb-4 flex items-center gap-2 rounded-lg border border-(--destructive)/30 bg-(--destructive)/10 p-3 text-sm text-(--destructive)"
		>
			<span class="font-medium">{$t('main.DICOM_upload_card.upload_failed')}:</span>
			<span>{uploadError}</span>
		</div>
	{/if}
	<div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
		{#each upload_projections[$locale as (typeof supportedLocales)[number]] as up}
			<div>
				<label class="mb-2 block text-sm font-medium" for="side-dicom">{up.label}</label>
				{#if project.session.projections[up.projection].sopInstanceUid}
					<div class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
						<img
							class="h-5 w-5 shrink-0"
							src={acceptedSVG}
							alt="accepted"
							style="filter: invert(48%) sepia(82%) saturate(455%) hue-rotate(94deg) brightness(93%) contrast(101%);"
						/>
						<div class="flex-1">
							<p class="text-sm font-medium text-green-800">{up.accepted}</p>
							<p class="text-xs text-green-600">{up.acceptedComment}</p>
						</div>
					</div>
				{:else}
					<button
						class="inline-flex h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-(--secondary)
                        px-4 py-2
                        text-sm font-medium whitespace-nowrap text-(--secondary-foreground)
                        transition-all
                        hover:bg-(--secondary)/80
                        focus-visible:ring-2
                        focus-visible:ring-(--ring)
                        focus-visible:ring-offset-2
                        focus-visible:ring-offset-(--background)
                        focus-visible:outline-none
                        disabled:pointer-events-none
                        disabled:opacity-50 has-[>img]:px-3
                        aria-invalid:border-(--destructive)
                        aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 [&_img]:pointer-events-none [&_img]:shrink-0 [&_img:not([class*='size-'])]:size-4"
						id={up.id}
						onclick={(e) => {
							up.callback(e);
						}}
					>
						<div class="flex truncate">
							<img src={documentSVG} alt="Document" />
							{up.btn}
						</div>
					</button>
				{/if}
			</div>
		{/each}
	</div>
	<div class="border-t border-(--border) pt-4">
		<p class="mt-2 text-center text-xs text-(--muted-foreground)">
			{#if project.session.projections.side.sopInstanceUid && project.session.projections.frontal.sopInstanceUid}
				<img
					class="inline h-5 w-5 shrink-0"
					src={acceptedSVG}
					alt="accepted"
					style="filter: invert(48%) sepia(82%) saturate(455%) hue-rotate(94deg) brightness(93%) contrast(101%);"
				/>
				{$t('main.DICOM_upload_card.p_under_button_accepted')}
			{:else}
				{$t('main.DICOM_upload_card.p_under_button')}
			{/if}
		</p>
	</div>
</div>
