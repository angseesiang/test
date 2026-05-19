import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { ResultsTable } from '../components/ResultsTable';
import { getAssessment } from '../lib/api';
import type { Assessment, AssessmentResultRow } from '../types';

type ExportFormat = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'markdown' | 'json' | 'xml' | 'html';

type ExportFormatOption = {
  value: ExportFormat;
  label: string;
  extension: string;
  mimeType: string;
};

type ExportColumn = {
  header: string;
  xmlName: string;
  getValue: (row: AssessmentResultRow) => unknown;
};

type SummaryField = {
  label: string;
  xmlName: string;
  value: string;
};

type ZipEntry = {
  name: string;
  content: string | Uint8Array;
};

const EXPORT_FORMATS: ExportFormatOption[] = [
  { value: 'pdf', label: 'PDF', extension: 'pdf', mimeType: 'application/pdf' },
  { value: 'docx', label: 'DOCX', extension: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { value: 'xlsx', label: 'XLSX', extension: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { value: 'csv', label: 'CSV', extension: 'csv', mimeType: 'text/csv;charset=utf-8' },
  { value: 'txt', label: 'TXT', extension: 'txt', mimeType: 'text/plain;charset=utf-8' },
  { value: 'markdown', label: 'Markdown', extension: 'md', mimeType: 'text/markdown;charset=utf-8' },
  { value: 'json', label: 'JSON', extension: 'json', mimeType: 'application/json;charset=utf-8' },
  { value: 'xml', label: 'XML', extension: 'xml', mimeType: 'application/xml;charset=utf-8' },
  { value: 'html', label: 'HTML', extension: 'html', mimeType: 'text/html;charset=utf-8' }
];

const ROW_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Match ID', xmlName: 'matchId', getValue: (row) => row.matchId },
  { header: 'Match Status', xmlName: 'matchStatus', getValue: (row) => row.matchStatus },
  { header: 'Exact Match', xmlName: 'isExactMatch', getValue: (row) => row.isExactMatch },
  { header: 'User Source Type', xmlName: 'userSourceType', getValue: (row) => row.userSourceType },
  { header: 'User File Name', xmlName: 'userFileName', getValue: (row) => row.userFileName },
  { header: 'User Location', xmlName: 'userLocation', getValue: (row) => row.userLocation },
  { header: 'User Wording', xmlName: 'userWording', getValue: (row) => row.userWording },
  { header: 'Vector Store ID', xmlName: 'vectorStoreId', getValue: (row) => row.vectorStoreId },
  { header: 'Vector Store Source File', xmlName: 'vectorStoreSourceFile', getValue: (row) => row.vectorStoreSourceFile },
  { header: 'Matched Vector Store Wording', xmlName: 'matchedVectorStoreWording', getValue: (row) => row.matchedVectorStoreWording },
  { header: 'Similarity Score', xmlName: 'similarityScore', getValue: (row) => row.similarityScore },
  { header: 'NIST AI RMF Function', xmlName: 'nistAiRmfFunction', getValue: (row) => row.nistAiRmfFunction },
  { header: 'Governance Interpretation', xmlName: 'governanceInterpretation', getValue: (row) => row.governanceInterpretation },
  { header: 'Risk Gap', xmlName: 'riskGap', getValue: (row) => row.riskGap },
  { header: 'Recommendation', xmlName: 'recommendation', getValue: (row) => row.recommendation }
];

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

function createSafeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'assessment';
}

function getFileDate(date: string) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return parsedDate.toISOString().slice(0, 10);
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getFormatOption(format: ExportFormat) {
  return EXPORT_FORMATS.find((option) => option.value === format) ?? EXPORT_FORMATS[0];
}

function getSummaryFields(assessment: Assessment): SummaryField[] {
  return [
    { label: 'Uploaded Files', xmlName: 'uploadedFiles', value: String(assessment.summary.uploadedFiles) },
    { label: 'Extracted Point Count', xmlName: 'extractedPointCount', value: String(assessment.summary.extractedPointCount) },
    { label: 'Matching Count', xmlName: 'matchingCount', value: String(assessment.summary.matchingCount) },
    { label: 'Possible Match Count', xmlName: 'possibleMatchCount', value: String(assessment.summary.possibleMatchCount) },
    { label: 'Not Matched Count', xmlName: 'notMatchedCount', value: String(assessment.summary.notMatchedCount) },
    { label: 'Not Extractable Count', xmlName: 'notExtractableCount', value: String(assessment.summary.notExtractableCount) },
    { label: 'Govern Score', xmlName: 'governScore', value: String(assessment.summary.governScore) },
    { label: 'Map Score', xmlName: 'mapScore', value: String(assessment.summary.mapScore) },
    { label: 'Measure Score', xmlName: 'measureScore', value: String(assessment.summary.measureScore) },
    { label: 'Manage Score', xmlName: 'manageScore', value: String(assessment.summary.manageScore) },
    { label: 'Average Score', xmlName: 'averageScore', value: `${assessment.summary.averageScore}/100` },
    { label: 'Maturity', xmlName: 'maturity', value: assessment.summary.maturity }
  ];
}

function getUploadedFilesText(assessment: Assessment) {
  return assessment.uploadedFileNames.length > 0 ? assessment.uploadedFileNames.join(', ') : 'None';
}

function getExportPayload(assessment: Assessment) {
  return {
    exportedAt: new Date().toISOString(),
    assessment
  };
}

function escapeCsvCell(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(value: string) {
  return escapeXml(value).replace(/\n/g, '<br />');
}

function escapeMarkdownCell(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function buildDelimitedRows(assessment: Assessment) {
  return assessment.rows.map((row) => ROW_EXPORT_COLUMNS.map((column) => stringifyValue(column.getValue(row))));
}

function buildCsv(assessment: Assessment) {
  const lines: string[][] = [
    ['Assessment Title', assessment.title],
    ['Assessment Date', formatDate(assessment.date)],
    ['Exported At', new Date().toISOString()],
    ['System Description', assessment.systemDescription || 'No text description provided.'],
    ['Uploaded Files', getUploadedFilesText(assessment)],
    [],
    ['Summary'],
    ['Metric', 'Value'],
    ...getSummaryFields(assessment).map((field) => [field.label, field.value]),
    [],
    ['Evidence Matching Results'],
    ROW_EXPORT_COLUMNS.map((column) => column.header),
    ...buildDelimitedRows(assessment)
  ];

  return lines.map((line) => line.map(escapeCsvCell).join(',')).join('\r\n');
}

function buildPlainText(assessment: Assessment) {
  const lines = [
    assessment.title,
    `Assessment date: ${formatDate(assessment.date)}`,
    `Exported at: ${new Date().toISOString()}`,
    '',
    'Summary',
    ...getSummaryFields(assessment).map((field) => `${field.label}: ${field.value}`),
    '',
    'System Description',
    assessment.systemDescription || 'No text description provided.',
    '',
    'Uploaded Files',
    getUploadedFilesText(assessment),
    '',
    'Evidence Matching Results'
  ];

  assessment.rows.forEach((row, index) => {
    lines.push('', `Result ${index + 1}`);
    ROW_EXPORT_COLUMNS.forEach((column) => {
      lines.push(`${column.header}: ${stringifyValue(column.getValue(row))}`);
    });
  });

  return lines.join('\n');
}

function buildMarkdown(assessment: Assessment) {
  const summaryRows = getSummaryFields(assessment)
    .map((field) => `| ${escapeMarkdownCell(field.label)} | ${escapeMarkdownCell(field.value)} |`)
    .join('\n');

  const headerRow = `| ${ROW_EXPORT_COLUMNS.map((column) => escapeMarkdownCell(column.header)).join(' | ')} |`;
  const dividerRow = `| ${ROW_EXPORT_COLUMNS.map(() => '---').join(' | ')} |`;
  const evidenceRows = buildDelimitedRows(assessment)
    .map((row) => `| ${row.map(escapeMarkdownCell).join(' | ')} |`)
    .join('\n');

  return [
    `# ${assessment.title}`,
    '',
    `**Assessment date:** ${formatDate(assessment.date)}`,
    `**Exported at:** ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    '| Metric | Value |',
    '| --- | --- |',
    summaryRows,
    '',
    '## System Description',
    '',
    assessment.systemDescription || 'No text description provided.',
    '',
    '## Uploaded Files',
    '',
    getUploadedFilesText(assessment),
    '',
    '## Evidence Matching Results',
    '',
    headerRow,
    dividerRow,
    evidenceRows || '| No results | |'
  ].join('\n');
}

function buildHtml(assessment: Assessment) {
  const summaryRows = getSummaryFields(assessment)
    .map((field) => `<tr><th>${escapeHtml(field.label)}</th><td>${escapeHtml(field.value)}</td></tr>`)
    .join('');

  const tableHeaders = ROW_EXPORT_COLUMNS.map((column) => `<th>${escapeHtml(column.header)}</th>`).join('');
  const tableRows = assessment.rows
    .map((row) => `<tr>${ROW_EXPORT_COLUMNS.map((column) => `<td>${escapeHtml(stringifyValue(column.getValue(row)))}</td>`).join('')}</tr>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(assessment.title)} Export</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; line-height: 1.5; margin: 32px; }
    h1, h2 { color: #1e293b; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0 28px; }
    th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    .wide-table { font-size: 12px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(assessment.title)}</h1>
  <p><strong>Assessment date:</strong> ${escapeHtml(formatDate(assessment.date))}</p>
  <p><strong>Exported at:</strong> ${escapeHtml(new Date().toISOString())}</p>

  <h2>Summary</h2>
  <table><tbody>${summaryRows}</tbody></table>

  <h2>System Description</h2>
  <p>${escapeHtml(assessment.systemDescription || 'No text description provided.')}</p>

  <h2>Uploaded Files</h2>
  <p>${escapeHtml(getUploadedFilesText(assessment))}</p>

  <h2>Evidence Matching Results</h2>
  <table class="wide-table">
    <thead><tr>${tableHeaders}</tr></thead>
    <tbody>${tableRows || '<tr><td>No results</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

function buildXml(assessment: Assessment) {
  const summaryFields = getSummaryFields(assessment)
    .map((field) => `    <${field.xmlName}>${escapeXml(field.value)}</${field.xmlName}>`)
    .join('\n');

  const uploadedFiles = assessment.uploadedFileNames
    .map((fileName) => `    <fileName>${escapeXml(fileName)}</fileName>`)
    .join('\n');

  const rows = assessment.rows
    .map((row, index) => {
      const fields = ROW_EXPORT_COLUMNS
        .map((column) => `      <${column.xmlName}>${escapeXml(stringifyValue(column.getValue(row)))}</${column.xmlName}>`)
        .join('\n');

      return `    <result index="${index + 1}">\n${fields}\n    </result>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentExport exportedAt="${escapeXml(new Date().toISOString())}">
  <title>${escapeXml(assessment.title)}</title>
  <assessmentDate>${escapeXml(assessment.date)}</assessmentDate>
  <formattedAssessmentDate>${escapeXml(formatDate(assessment.date))}</formattedAssessmentDate>
  <summary>
${summaryFields}
  </summary>
  <systemDescription>${escapeXml(assessment.systemDescription || 'No text description provided.')}</systemDescription>
  <uploadedFiles>
${uploadedFiles || '    <fileName>None</fileName>'}
  </uploadedFiles>
  <evidenceMatchingResults>
${rows}
  </evidenceMatchingResults>
</assessmentExport>`;
}

function sanitizePdfText(value: string) {
  return value
    .replace(/\t/g, '    ')
    .replace(/[^\x20-\x7E]/g, '?');
}

function wrapPdfLine(line: string, maxCharacters: number) {
  const sanitizedLine = sanitizePdfText(line);
  if (sanitizedLine.length <= maxCharacters) return [sanitizedLine];

  const wrapped: string[] = [];
  let remaining = sanitizedLine;

  while (remaining.length > maxCharacters) {
    const slice = remaining.slice(0, maxCharacters + 1);
    const breakAt = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf(','), slice.lastIndexOf(';'));
    const index = breakAt > 20 ? breakAt : maxCharacters;
    wrapped.push(remaining.slice(0, index).trimEnd());
    remaining = remaining.slice(index).trimStart();
  }

  if (remaining.length > 0) wrapped.push(remaining);
  return wrapped;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdf(assessment: Assessment) {
  const encoder = new TextEncoder();
  const wrappedLines = buildPlainText(assessment).split('\n').flatMap((line) => wrapPdfLine(line, 96));
  const linesPerPage = 52;
  const pages: string[][] = [];

  for (let index = 0; index < wrappedLines.length; index += linesPerPage) {
    pages.push(wrappedLines.slice(index, index + linesPerPage));
  }

  if (pages.length === 0) pages.push(['No assessment content available.']);

  const pageObjectStart = 3;
  const contentObjectStart = pageObjectStart + pages.length;
  const fontObjectNumber = contentObjectStart + pages.length;
  const objects: string[] = [];
  const pageKids = pages.map((_, index) => `${pageObjectStart + index} 0 R`).join(' ');

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageKids}] /Count ${pages.length} >>`;

  pages.forEach((pageLines, index) => {
    const pageObjectNumber = pageObjectStart + index;
    const contentObjectNumber = contentObjectStart + index;
    const stream = [
      'BT',
      '/F1 10 Tf',
      '40 790 Td',
      '14 TL',
      ...pageLines.map((line, lineIndex) => `${lineIndex === 0 ? '' : 'T* '}(${escapePdfText(line)}) Tj`),
      'ET'
    ].join('\n');

    objects[pageObjectNumber] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
    objects[contentObjectNumber] = `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`;
  });

  objects[fontObjectNumber] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    offsets[objectNumber] = encoder.encode(pdf).length;
    pdf += `${objectNumber} 0 obj\n${objects[objectNumber]}\nendobj\n`;
  }

  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += '0000000000 65535 f \n';

  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    pdf += `${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return encoder.encode(pdf);
}

function docxParagraph(text: string, options: { bold?: boolean; size?: number } = {}) {
  const paragraphs = (text || ' ').split(/\r?\n/);
  const properties = [
    options.bold ? '<w:b />' : '',
    options.size ? `<w:sz w:val="${options.size}" />` : ''
  ].join('');
  const runProperties = properties ? `<w:rPr>${properties}</w:rPr>` : '';

  return paragraphs
    .map((paragraph) => `<w:p><w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(paragraph)}</w:t></w:r></w:p>`)
    .join('');
}

function buildDocx(assessment: Assessment) {
  const bodyParts = [
    docxParagraph(assessment.title, { bold: true, size: 32 }),
    docxParagraph(`Assessment date: ${formatDate(assessment.date)}`),
    docxParagraph(`Exported at: ${new Date().toISOString()}`),
    docxParagraph('Summary', { bold: true, size: 26 }),
    ...getSummaryFields(assessment).map((field) => docxParagraph(`${field.label}: ${field.value}`)),
    docxParagraph('System Description', { bold: true, size: 26 }),
    docxParagraph(assessment.systemDescription || 'No text description provided.'),
    docxParagraph('Uploaded Files', { bold: true, size: 26 }),
    docxParagraph(getUploadedFilesText(assessment)),
    docxParagraph('Evidence Matching Results', { bold: true, size: 26 })
  ];

  assessment.rows.forEach((row, index) => {
    bodyParts.push(docxParagraph(`Result ${index + 1}`, { bold: true, size: 24 }));
    ROW_EXPORT_COLUMNS.forEach((column) => {
      bodyParts.push(docxParagraph(`${column.header}: ${stringifyValue(column.getValue(row))}`));
    });
  });

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyParts.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840" />
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0" />
    </w:sectPr>
  </w:body>
</w:document>`;

  return createZip([
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="xml" ContentType="application/xml" />
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" />
</Types>`
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml" />
</Relationships>`
    },
    { name: 'word/document.xml', content: documentXml }
  ]);
}

function columnName(columnIndex: number) {
  let index = columnIndex;
  let name = '';

  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }

  return name;
}

function buildWorkbookRows(assessment: Assessment) {
  return [
    ['Assessment Title', assessment.title],
    ['Assessment Date', formatDate(assessment.date)],
    ['Exported At', new Date().toISOString()],
    ['System Description', assessment.systemDescription || 'No text description provided.'],
    ['Uploaded Files', getUploadedFilesText(assessment)],
    [],
    ['Summary'],
    ['Metric', 'Value'],
    ...getSummaryFields(assessment).map((field) => [field.label, field.value]),
    [],
    ['Evidence Matching Results'],
    ROW_EXPORT_COLUMNS.map((column) => column.header),
    ...buildDelimitedRows(assessment)
  ];
}

function buildXlsx(assessment: Assessment) {
  const rows = buildWorkbookRows(assessment);
  const sheetRows = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((cell, columnIndex) => {
          const reference = `${columnName(columnIndex + 1)}${rowNumber}`;
          return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
        })
        .join('');

      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join('');

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;

  return createZip([
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="xml" ContentType="application/xml" />
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" />
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" />
</Types>`
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml" />
</Relationships>`
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Assessment" sheetId="1" r:id="rId1" /></sheets>
</workbook>`
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml" />
</Relationships>`
    },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml }
  ]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
})();

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });

  return output;
}

function zipTimeAndDate(date: Date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function createZip(entries: ZipEntry[]) {
  const encoder = new TextEncoder();
  const localFiles: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;
  const modified = zipTimeAndDate(new Date());

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const contentBytes = typeof entry.content === 'string' ? encoder.encode(entry.content) : entry.content;
    const checksum = crc32(contentBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, modified.time, true);
    localView.setUint16(12, modified.date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, contentBytes.length, true);
    localView.setUint32(22, contentBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const localFile = concatBytes([localHeader, contentBytes]);
    localFiles.push(localFile);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, modified.time, true);
    centralView.setUint16(14, modified.date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, contentBytes.length, true);
    centralView.setUint32(24, contentBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralDirectory.push(centralHeader);

    offset += localFile.length;
  });

  const centralDirectoryOffset = offset;
  const centralDirectoryBytes = concatBytes(centralDirectory);
  const endRecord = new Uint8Array(22);
  const endRecordView = new DataView(endRecord.buffer);
  endRecordView.setUint32(0, 0x06054b50, true);
  endRecordView.setUint16(4, 0, true);
  endRecordView.setUint16(6, 0, true);
  endRecordView.setUint16(8, entries.length, true);
  endRecordView.setUint16(10, entries.length, true);
  endRecordView.setUint32(12, centralDirectoryBytes.length, true);
  endRecordView.setUint32(16, centralDirectoryOffset, true);
  endRecordView.setUint16(20, 0, true);

  return concatBytes([...localFiles, centralDirectoryBytes, endRecord]);
}

function createExportFile(assessment: Assessment, format: ExportFormat): BlobPart[] {
  switch (format) {
    case 'pdf':
      return [buildPdf(assessment)];
    case 'docx':
      return [buildDocx(assessment)];
    case 'xlsx':
      return [buildXlsx(assessment)];
    case 'csv':
      return [buildCsv(assessment)];
    case 'txt':
      return [buildPlainText(assessment)];
    case 'markdown':
      return [buildMarkdown(assessment)];
    case 'xml':
      return [buildXml(assessment)];
    case 'html':
      return [buildHtml(assessment)];
    case 'json':
    default:
      return [JSON.stringify(getExportPayload(assessment), null, 2)];
  }
}

function exportAssessment(assessment: Assessment, format: ExportFormat) {
  const option = getFormatOption(format);
  const fileName = `${createSafeFileName(assessment.title)}-${getFileDate(assessment.date)}.${option.extension}`;
  const blob = new Blob(createExportFile(assessment, format), { type: option.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function AssessmentDetailPage({ assessmentId, goBack }: { assessmentId: string; goBack: () => void }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [message, setMessage] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');

  useEffect(() => {
    getAssessment(assessmentId)
      .then((data) => setAssessment(data.assessment))
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load assessment.'));
  }, [assessmentId]);

  if (message) {
    return <div><Button onClick={goBack}>← Back</Button><div className="errorBox">{message}</div></div>;
  }

  if (!assessment) {
    return <div><Button onClick={goBack}>← Back</Button><p className="muted">Loading assessment...</p></div>;
  }

  const selectedFormat = getFormatOption(exportFormat);

  return (
    <div>
      <div className="pageHeader rowHeader">
        <div>
          <button className="linkButton" onClick={goBack}>← Back to assessments</button>
          <h1>{assessment.title}</h1>
          <p>Assessment {formatDate(assessment.date)}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <label className="fieldLabel" style={{ marginTop: 0, minWidth: 170 }}>
            Export format
            <select
              value={exportFormat}
              onChange={(event: { target: { value: string } }) => setExportFormat(event.target.value as ExportFormat)}
              aria-label="Select export format"
            >
              {EXPORT_FORMATS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <Button className="primary" onClick={() => exportAssessment(assessment, exportFormat)}>
            Export {selectedFormat.label}
          </Button>
        </div>
      </div>

      <div className="statGrid detailStats">
        <div className="statCard"><span>Average Score</span><strong>{assessment.summary.averageScore}/100</strong></div>
        <div className="statCard"><span>Maturity</span><strong>{assessment.summary.maturity}</strong></div>
        <div className="statCard"><span>Matching</span><strong>{assessment.summary.matchingCount}</strong></div>
        <div className="statCard"><span>Not Matched</span><strong>{assessment.summary.notMatchedCount}</strong></div>
      </div>

      <section className="panel detailPanel">
        <div className="panelHeader">
          <h2>System Description</h2>
        </div>
        <p>{assessment.systemDescription || 'No text description provided.'}</p>
        {assessment.uploadedFileNames.length > 0 && (
          <p><strong>Uploaded files:</strong> {assessment.uploadedFileNames.join(', ')}</p>
        )}
      </section>

      <section className="panel detailPanel">
        <div className="panelHeader">
          <h2>Evidence Matching Results</h2>
          <p>Matching, partial matching, and recommendation results for extracted user points.</p>
        </div>
        <ResultsTable rows={assessment.rows} />
      </section>
    </div>
  );
}
