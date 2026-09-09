import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { DocBlock } from './document-model';

/** Minimal slice of the pdfmake browser build we actually call. */
interface PdfMakeModule {
	vfs?: Record<string, string>;
	createPdf(docDefinition: TDocumentDefinitions): {
		open(options?: object, win?: Window | null): void;
		print(options?: object, win?: Window | null): void;
	};
}

let cached: PdfMakeModule | null = null;

/**
 * Loads the pdfmake browser bundle + its embedded font VFS on demand, so the
 * ~2 MB library never enters the main app chunk. The module/interop shape
 * differs between Vite's CJS wrapping and pdfmake's own typings, hence the
 * defensive `default` unwrapping.
 */
async function loadPdfMake(): Promise<PdfMakeModule> {
	if (cached) return cached;
	const [pdfMod, vfsMod] = await Promise.all([
		import('pdfmake/build/pdfmake'),
		import('pdfmake/build/vfs_fonts')
	]);
	const pdfMake =
		(pdfMod as unknown as { default?: PdfMakeModule }).default ??
		(pdfMod as unknown as PdfMakeModule);
	const vfs =
		(vfsMod as unknown as { default?: Record<string, string> }).default ??
		(vfsMod as unknown as Record<string, string>);
	if (!pdfMake.vfs) pdfMake.vfs = vfs;
	cached = pdfMake;
	return pdfMake;
}

const CONTENT_WIDTH = 483; // A4 (595.28pt) minus the 56pt side margins.

function headingMargin(level: 1 | 2 | 3): [number, number, number, number] {
	if (level === 1) return [0, 14, 0, 6];
	if (level === 2) return [0, 10, 0, 4];
	return [0, 6, 0, 3];
}

function blocksToContent(model: DocBlock[]): Content[] {
	const out: Content[] = [];
	for (const b of model) {
		switch (b.type) {
			case 'docTitle':
				out.push({ text: b.text, style: 'docTitle' });
				break;
			case 'metaTable':
				out.push({
					table: {
						widths: ['32%', '68%'],
						body: b.rows.map(([k, v]) => [
							{ text: k, style: 'metaKey' },
							{ text: v, style: 'metaVal' }
						])
					},
					layout: 'lightHorizontalLines',
					margin: [0, 6, 0, 6]
				});
				break;
			case 'heading':
				out.push({ text: b.text, style: `h${b.level}`, margin: headingMargin(b.level) });
				break;
			case 'paragraph':
				out.push({ text: b.text, style: 'body' });
				break;
			case 'rankedDiagnosis':
				out.push({
					columns: [
						{ text: b.label, style: 'diagLabel', width: '*' },
						{ text: `${b.probabilityPct}%`, style: 'diagPct', width: 'auto' }
					],
					margin: [0, 6, 0, 2]
				});
				break;
			case 'bullet':
				out.push({ ul: [{ text: b.text }], style: 'body', margin: [10, 0, 0, 3] });
				break;
			case 'divider':
				out.push({
					canvas: [
						{
							type: 'line',
							x1: 0,
							y1: 4,
							x2: CONTENT_WIDTH,
							y2: 4,
							lineWidth: 0.5,
							lineColor: '#999999'
						}
					],
					margin: [0, 6, 0, 10]
				});
				break;
			case 'pageBreak':
				out.push({ text: '', pageBreak: 'before' });
				break;
			case 'disclaimer':
				out.push({ text: b.text, style: 'disclaimer' });
				break;
		}
	}
	return out;
}

function buildDocDefinition(model: DocBlock[], headerText: string): TDocumentDefinitions {
	return {
		pageSize: 'A4',
		pageMargins: [56, 64, 56, 56],
		info: { title: headerText },
		header: (currentPage) =>
			currentPage === 1
				? undefined
				: { text: headerText, style: 'runningHeader', margin: [56, 28, 56, 0] },
		footer: (currentPage, pageCount) => ({
			text: `${currentPage} / ${pageCount}`,
			style: 'footer',
			alignment: 'center',
			margin: [56, 16, 56, 0]
		}),
		content: blocksToContent(model),
		defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.25, color: '#111111' },
		styles: {
			docTitle: { fontSize: 18, bold: true, margin: [0, 0, 0, 8] },
			h1: { fontSize: 14, bold: true },
			h2: { fontSize: 12, bold: true },
			h3: { fontSize: 11, bold: true },
			body: { fontSize: 10.5, margin: [0, 2, 0, 4] },
			metaKey: { fontSize: 9.5, bold: true, color: '#333333' },
			metaVal: { fontSize: 9.5 },
			diagLabel: { fontSize: 10.5, bold: true },
			diagPct: { fontSize: 10.5, bold: true },
			runningHeader: { fontSize: 8, color: '#888888' },
			footer: { fontSize: 8, color: '#888888' },
			disclaimer: { fontSize: 8.5, italics: true, color: '#666666', margin: [0, 4, 0, 0] }
		}
	};
}

/**
 * Generates the PDF and shows it in `targetWin` (a tab the caller opened
 * synchronously inside the click gesture, so pop-up blockers allow it). Falls
 * back to letting pdfmake open its own tab when `targetWin` is null.
 */
export async function openPdf(
	model: DocBlock[],
	headerText: string,
	targetWin: Window | null
): Promise<void> {
	const pdfMake = await loadPdfMake();
	pdfMake.createPdf(buildDocDefinition(model, headerText)).open({}, targetWin);
}

/**
 * Generates the PDF, shows it in `targetWin` and opens the browser's native
 * print dialog on it. With `targetWin` null, pdfmake prints from a hidden
 * iframe instead.
 */
export async function printPdf(
	model: DocBlock[],
	headerText: string,
	targetWin: Window | null
): Promise<void> {
	const pdfMake = await loadPdfMake();
	pdfMake.createPdf(buildDocDefinition(model, headerText)).print({}, targetWin);
}
