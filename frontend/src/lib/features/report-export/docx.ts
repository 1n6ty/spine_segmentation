import type * as DocxNs from 'docx';
import type { DocBlock } from './document-model';
import { saveBlob } from './save-blob';

type Block = DocxNs.Paragraph | DocxNs.Table;

/**
 * Renders the report document model to a real `.docx` (Office Open XML) file
 * entirely in the browser via the `docx` library, then triggers a download.
 * The library (~450 KB) is dynamically imported so it stays out of the main
 * chunk.
 */
export async function exportDocx(model: DocBlock[], filename: string): Promise<void> {
	const {
		Document,
		Packer,
		Paragraph,
		TextRun,
		HeadingLevel,
		Table,
		TableRow,
		TableCell,
		WidthType,
		BorderStyle,
		AlignmentType,
		Footer,
		PageNumber
	} = await import('docx');

	const edge = { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' };

	const metaTable = (rows: [string, string][]): DocxNs.Table =>
		new Table({
			width: { size: 100, type: WidthType.PERCENTAGE },
			borders: {
				top: edge,
				bottom: edge,
				left: edge,
				right: edge,
				insideHorizontal: edge,
				insideVertical: edge
			},
			rows: rows.map(
				([k, v]) =>
					new TableRow({
						children: [
							new TableCell({
								width: { size: 32, type: WidthType.PERCENTAGE },
								children: [
									new Paragraph({ children: [new TextRun({ text: k, bold: true, size: 19 })] })
								]
							}),
							new TableCell({
								width: { size: 68, type: WidthType.PERCENTAGE },
								children: [new Paragraph({ children: [new TextRun({ text: v, size: 19 })] })]
							})
						]
					})
			)
		});

	const headingLevel = (level: 1 | 2 | 3) =>
		level === 1
			? HeadingLevel.HEADING_1
			: level === 2
				? HeadingLevel.HEADING_2
				: HeadingLevel.HEADING_3;

	const children: Block[] = [];
	for (const b of model) {
		switch (b.type) {
			case 'docTitle':
				children.push(
					new Paragraph({
						children: [new TextRun({ text: b.text, bold: true, size: 36 })],
						spacing: { after: 160 }
					})
				);
				break;
			case 'metaTable':
				children.push(metaTable(b.rows));
				break;
			case 'heading':
				children.push(
					new Paragraph({
						text: b.text,
						heading: headingLevel(b.level),
						spacing: { before: 160, after: 60 }
					})
				);
				break;
			case 'paragraph':
				children.push(new Paragraph({ children: [new TextRun(b.text)], spacing: { after: 80 } }));
				break;
			case 'rankedDiagnosis':
				children.push(
					new Paragraph({
						children: [
							new TextRun({ text: b.label, bold: true }),
							new TextRun({ text: `  —  ${b.probabilityPct}%`, bold: true })
						],
						spacing: { before: 100, after: 20 }
					})
				);
				break;
			case 'bullet':
				children.push(
					new Paragraph({ text: b.text, bullet: { level: 0 }, spacing: { after: 20 } })
				);
				break;
			case 'divider':
				children.push(
					new Paragraph({
						children: [],
						border: {
							bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 }
						},
						spacing: { before: 120, after: 120 }
					})
				);
				break;
			case 'pageBreak':
				children.push(new Paragraph({ children: [], pageBreakBefore: true }));
				break;
			case 'disclaimer':
				children.push(
					new Paragraph({
						children: [new TextRun({ text: b.text, italics: true, color: '666666', size: 17 })],
						spacing: { before: 100 }
					})
				);
				break;
		}
	}

	const doc = new Document({
		styles: { default: { document: { run: { font: 'Times New Roman', size: 21 } } } },
		sections: [
			{
				footers: {
					default: new Footer({
						children: [
							new Paragraph({
								alignment: AlignmentType.CENTER,
								children: [
									new TextRun({
										children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES],
										size: 16,
										color: '888888'
									})
								]
							})
						]
					})
				},
				children
			}
		]
	});

	saveBlob(await Packer.toBlob(doc), filename);
}
