import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import xlsx from 'xlsx';

export type ExtractedBlock = {
  sourceType: 'prompt' | 'file';
  sourceLabel: string;
  fileName?: string;
  location: Record<string, unknown>;
  text: string;
  extractionStatus: 'extracted' | 'not_extractable';
};

function cleanText(input: string) {
  return input
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isMostlyReadableText(text: string) {
  if (!text.trim()) return false;

  const sample = text.slice(0, 5000);
  let readable = 0;

  for (const ch of sample) {
    const code = ch.charCodeAt(0);
    if (
      ch === '\n' ||
      ch === '\r' ||
      ch === '\t' ||
      (code >= 32 && code <= 126) ||
      (code >= 0x00a0 && code <= 0xffff)
    ) {
      readable++;
    }
  }

  return readable / sample.length > 0.85;
}

function getExtension(fileName: string) {
  return path.extname(fileName).toLowerCase().replace('.', '');
}

function extractReadableTextFromBuffer(buffer: Buffer) {
  const text = cleanText(buffer.toString('utf8'));
  return isMostlyReadableText(text) ? text : '';
}

export function createPromptBlock(systemDescription: string): ExtractedBlock[] {
  const text = cleanText(systemDescription);
  if (!text) return [];

  return [
    {
      sourceType: 'prompt',
      sourceLabel: 'System Description',
      location: { input: 'systemDescription' },
      text,
      extractionStatus: 'extracted'
    }
  ];
}

export async function extractAnyFileText(file: Express.Multer.File): Promise<ExtractedBlock[]> {
  const fileName = file.originalname;
  const ext = getExtension(fileName);

  try {
    if (ext === 'pdf') {
      const parsed = await pdfParse(file.buffer);
      const text = cleanText(parsed.text);
      return [
        {
          sourceType: 'file',
          sourceLabel: fileName,
          fileName,
          location: { file: fileName, page: 'combined text' },
          text,
          extractionStatus: text ? 'extracted' : 'not_extractable'
        }
      ];
    }

    if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      const text = cleanText(result.value);
      return [
        {
          sourceType: 'file',
          sourceLabel: fileName,
          fileName,
          location: { file: fileName, documentType: 'docx' },
          text,
          extractionStatus: text ? 'extracted' : 'not_extractable'
        }
      ];
    }

    if (ext === 'doc') {
      const text = extractReadableTextFromBuffer(file.buffer);
      return [
        {
          sourceType: 'file',
          sourceLabel: fileName,
          fileName,
          location: { file: fileName, documentType: 'doc', extraction: 'best effort' },
          text,
          extractionStatus: text ? 'extracted' : 'not_extractable'
        }
      ];
    }

    if (['xls', 'xlsx'].includes(ext)) {
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      const blocks: ExtractedBlock[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][];

        rows.forEach((row, rowIndex) => {
          const rowText = row
            .map((cell, cellIndex) => {
              const value = String(cell ?? '').trim();
              return value ? `Column ${cellIndex + 1}: ${value}` : '';
            })
            .filter(Boolean)
            .join(' | ');

          if (rowText.trim()) {
            blocks.push({
              sourceType: 'file',
              sourceLabel: fileName,
              fileName,
              location: { file: fileName, sheet: sheetName, row: rowIndex + 1 },
              text: rowText,
              extractionStatus: 'extracted'
            });
          }
        });
      }

      if (blocks.length) return blocks;
    }

    const text = extractReadableTextFromBuffer(file.buffer);
    return [
      {
        sourceType: 'file',
        sourceLabel: fileName,
        fileName,
        location: { file: fileName, extension: ext || 'unknown', extraction: 'best effort text' },
        text,
        extractionStatus: text ? 'extracted' : 'not_extractable'
      }
    ];
  } catch (error) {
    const text = extractReadableTextFromBuffer(file.buffer);
    return [
      {
        sourceType: 'file',
        sourceLabel: fileName,
        fileName,
        location: {
          file: fileName,
          extension: ext || 'unknown',
          extractionError: error instanceof Error ? error.message : 'Unknown extraction error'
        },
        text,
        extractionStatus: text ? 'extracted' : 'not_extractable'
      }
    ];
  }
}
