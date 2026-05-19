import { openai } from '../lib/openai';

export type StoreMatch = {
  vectorStoreId: string;
  matchedText: string;
  sourceFile: string;
  score: number;
  raw: unknown;
};

function extractContentText(item: any) {
  const content = item?.content;

  if (Array.isArray(content)) {
    return content
      .map((part) => part?.text ?? part?.content ?? '')
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  if (typeof content === 'string') return content.trim();
  return '';
}

export async function searchAllVectorStores(query: string, storeIds: string[], topN = 5): Promise<StoreMatch[]> {
  const results: StoreMatch[] = [];

  if (!openai || !storeIds.length || !query.trim()) {
    return results;
  }

  for (const vectorStoreId of storeIds) {
    try {
      const response = await openai.vectorStores.search(vectorStoreId, {
        query,
        max_num_results: topN
      });

      for (const item of response.data ?? []) {
        results.push({
          vectorStoreId,
          matchedText: extractContentText(item),
          sourceFile: (item as any).filename ?? (item as any).file_id ?? '-',
          score: Number((item as any).score ?? 0),
          raw: item
        });
      }
    } catch (error) {
      results.push({
        vectorStoreId,
        matchedText: '',
        sourceFile: '-',
        score: 0,
        raw: {
          error: error instanceof Error ? error.message : 'Vector store search failed.'
        }
      });
    }
  }

  return results.filter((result) => result.matchedText.trim().length > 0);
}
