/**
 * Triggers a browser download of `blob` as `filename` via a transient anchor.
 * Lives in the feature (not `shared/`) because it touches the DOM, which
 * `shared/` must not — see `frontend/docs/architecture.md`.
 */
export function saveBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.rel = 'noopener';
	document.body.appendChild(a);
	a.click();
	a.remove();
	// Revoke after the click has been handled so the download can start.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
