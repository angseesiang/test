export function chunkText(input: string, chunkSize = 900, overlap = 150): string[] {
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}
