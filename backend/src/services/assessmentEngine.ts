import { env } from '../config/env';
import { createPromptBlock, extractAnyFileText, ExtractedBlock } from './extractors';
import { searchAllVectorStores } from './vectorSearch';
import {
  blocksToAnalysisPoints,
  buildNotExtractableRow,
  buildResultRow,
  getBestMatch,
  isIdenticalOrNearIdentical
} from '../utils/matching';
import { AssessmentResultRow, AssessmentSummary, RmfFunction } from '../types';

function maturityFromScore(score: number) {
  if (score >= 85) return 'Optimized' as const;
  if (score >= 70) return 'Managed' as const;
  if (score >= 50) return 'Defined' as const;
  if (score >= 25) return 'Developing' as const;
  return 'Initial' as const;
}

function scoreRowsForFunction(rows: AssessmentResultRow[], rmf: RmfFunction) {
  const relevantRows = rows.filter((row) => row.nistAiRmfFunction === rmf && row.matchStatus !== 'NOT_EXTRACTABLE');
  if (!relevantRows.length) return 0;

  const points = relevantRows.reduce((sum, row) => {
    if (row.matchStatus === 'MATCHING') return sum + 1;
    if (row.matchStatus === 'POSSIBLE_MATCH_NOT_IDENTICAL') return sum + 0.5;
    return sum;
  }, 0);

  return Math.round((points / relevantRows.length) * 100);
}

export async function generateAssessmentFromInput(input: {
  systemDescription: string;
  files: Express.Multer.File[];
}) {
  const blocks: ExtractedBlock[] = [];
  const rows: AssessmentResultRow[] = [];

  blocks.push(...createPromptBlock(input.systemDescription));

  for (const file of input.files) {
    const extractedBlocks = await extractAnyFileText(file);

    for (const block of extractedBlocks) {
      if (block.extractionStatus === 'extracted' && block.text.trim()) {
        blocks.push(block);
      } else {
        rows.push(buildNotExtractableRow(file.originalname, block.location));
      }
    }
  }

  const points = blocksToAnalysisPoints(blocks, env.maxPointsPerAssessment);

  for (const point of points) {
    const matches = await searchAllVectorStores(point.userWording, env.vectorStoreIds, 5);
    const exactMatches = matches.filter((match) => isIdenticalOrNearIdentical(point.userWording, match.matchedText));

    if (exactMatches.length > 0) {
      exactMatches.forEach((match, index) => {
        rows.push(
          buildResultRow({
            matchId: `${point.pointId}-match-${index + 1}`,
            point,
            match,
            status: 'MATCHING',
            isExactMatch: true
          })
        );
      });
      continue;
    }

    const bestMatch = getBestMatch(matches);

    if (bestMatch && bestMatch.score >= env.minPossibleScore) {
      rows.push(
        buildResultRow({
          matchId: `${point.pointId}-possible`,
          point,
          match: bestMatch,
          status: 'POSSIBLE_MATCH_NOT_IDENTICAL',
          isExactMatch: false
        })
      );
      continue;
    }

    rows.push(
      buildResultRow({
        matchId: `${point.pointId}-not-matched`,
        point,
        match: bestMatch,
        status: 'NOT_MATCHED',
        isExactMatch: false
      })
    );
  }

  const governScore = scoreRowsForFunction(rows, 'Govern');
  const mapScore = scoreRowsForFunction(rows, 'Map');
  const measureScore = scoreRowsForFunction(rows, 'Measure');
  const manageScore = scoreRowsForFunction(rows, 'Manage');
  const averageScore = Math.round((governScore + mapScore + measureScore + manageScore) / 4);

  const summary: AssessmentSummary = {
    uploadedFiles: input.files.length,
    extractedPointCount: points.length,
    matchingCount: rows.filter((row) => row.matchStatus === 'MATCHING').length,
    possibleMatchCount: rows.filter((row) => row.matchStatus === 'POSSIBLE_MATCH_NOT_IDENTICAL').length,
    notMatchedCount: rows.filter((row) => row.matchStatus === 'NOT_MATCHED').length,
    notExtractableCount: rows.filter((row) => row.matchStatus === 'NOT_EXTRACTABLE').length,
    governScore,
    mapScore,
    measureScore,
    manageScore,
    averageScore,
    maturity: maturityFromScore(averageScore)
  };

  return { rows, summary };
}

export function titleFromDescription(description: string, files: Express.Multer.File[]) {
  const cleaned = description.replace(/\s+/g, ' ').trim();

  if (cleaned) {
    return cleaned.length > 95 ? `${cleaned.slice(0, 95)}...` : cleaned;
  }

  if (files.length === 1) return files[0].originalname;
  if (files.length > 1) return `${files.length} uploaded documents`;
  return 'Untitled assessment';
}
