import { openai } from '../lib/openai';

export type StoreMatch = {
  vectorStoreId: string;
  matchedText: string;
  sourceFile?: string;
  score: number;
  raw: unknown;
};

export async function searchAllVectorStores(query: string, storeIds: string[], topN = 3): Promise<StoreMatch[]> {
  const results: StoreMatch[] = [];
  for (const vectorStoreId of storeIds) {
    const res = await openai.vectorStores.search(vectorStoreId, { query, max_num_results: topN });
    for (const item of res.data ?? []) {
      results.push({
        vectorStoreId,
        matchedText: item.content?.[0]?.text ?? '',
        sourceFile: item.filename,
        score: item.score ?? 0,
        raw: item,
      });
    }
  }
  return results;
}
