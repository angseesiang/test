import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import xlsx from 'xlsx';

export async function extractPdfText(buffer: Buffer) {
  const parsed = await pdfParse(buffer);
  return [{ location: { page: 1 }, text: parsed.text }];
}

export async function extractDocxText(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return [{ location: { paragraph: 1 }, text: result.value }];
}

export async function extractXlsxText(buffer: Buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const out: Array<{ location: Record<string, unknown>; text: string }> = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
    rows.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        if (cell != null && String(cell).trim()) {
          out.push({ location: { sheet: sheetName, row: rIdx + 1, cell: cIdx + 1 }, text: String(cell) });
        }
      });
    });
  }
  return out;
}
