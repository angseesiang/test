import { env } from '../config/env';
import { StoreMatch } from '../services/vectorSearch';
import { AssessmentResultRow, RmfFunction } from '../types';

export type AnalysisPoint = {
  pointId: string;
  sourceType: 'prompt' | 'file';
  sourceLabel: string;
  userFileName?: string;
  location: Record<string, unknown>;
  userWording: string;
};

function normalizeForCompare(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(input: string) {
  return new Set(normalizeForCompare(input).split(' ').filter(Boolean));
}

function jaccardSimilarity(a: string, b: string) {
  const setA = wordSet(a);
  const setB = wordSet(b);

  if (!setA.size || !setB.size) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection += 1;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function isIdenticalOrNearIdentical(userText: string, storeText: string) {
  const userNorm = normalizeForCompare(userText);
  const storeNorm = normalizeForCompare(storeText);

  if (!userNorm || !storeNorm) return false;
  if (storeNorm.includes(userNorm) && userNorm.length >= 40) return true;
  if (userNorm.includes(storeNorm) && storeNorm.length >= 80) return true;

  return jaccardSimilarity(userText, storeText) >= 0.92;
}

export function classifyRmf(text: string): RmfFunction {
  const t = text.toLowerCase();

  if (/(policy|policies|accountability|role|responsibility|access control|audit|approval|governance|oversight|owner|committee|user management|admin)/.test(t)) {
    return 'Govern';
  }

  if (/(purpose|context|stakeholder|use case|intended use|impact|data source|data sources|business process|target user|user base|system description)/.test(t)) {
    return 'Map';
  }

  if (/(metric|metrics|measure|test|testing|score|accuracy|performance|bias|evaluate|evaluation|validation|monitoring result|benchmark|quality)/.test(t)) {
    return 'Measure';
  }

  return 'Manage';
}

export function recommendationForUnmatched(userText: string, bestMatch?: StoreMatch) {
  const rmf = classifyRmf(userText);

  if (bestMatch && bestMatch.score >= env.minPossibleScore) {
    return `Related evidence exists, but identical wording was not found. Review the retrieved evidence, align terminology, and add explicit traceable documentation if this point is intended to satisfy the same ${rmf} requirement.`;
  }

  if (rmf === 'Govern') {
    return 'Add governance evidence such as policies, accountable owners, approval records, access controls, audit logging, oversight roles, and review cadence.';
  }

  if (rmf === 'Map') {
    return 'Add mapping evidence such as intended use, system context, target users, stakeholders, data sources, impact analysis, and operating boundaries.';
  }

  if (rmf === 'Measure') {
    return 'Add measurement evidence such as metrics, test results, evaluation criteria, model performance records, validation evidence, bias checks, and security checks.';
  }

  return 'Add risk-management evidence such as mitigation plans, remediation workflow, monitoring process, issue ownership, approval evidence, and residual-risk tracking.';
}

export function interpretationForMatch(isExact: boolean, score: number, rmf: RmfFunction) {
  if (isExact) {
    return `Identical or near-identical wording was found. Treat this as matched evidence for ${rmf}, subject to human review.`;
  }

  if (score >= env.minPossibleScore) {
    return `A related vector-store result was found, but the wording is not identical. Treat this as partial ${rmf} alignment until reviewed.`;
  }

  return `No reliable identical evidence was found for ${rmf}.`;
}

function splitTextIntoCandidatePoints(text: string) {
  const cleaned = text.replace(/\r/g, '\n').trim();
  if (!cleaned) return [];

  const lineCandidates = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 12);

  if (lineCandidates.length >= 2) return lineCandidates;

  const sentenceCandidates = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12);

  if (sentenceCandidates.length >= 2) return sentenceCandidates;

  if (cleaned.length <= 900) return [cleaned];

  const chunks: string[] = [];
  const chunkSize = 900;
  const overlap = 120;
  let start = 0;

  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    chunks.push(cleaned.slice(start, end).trim());
    if (end >= cleaned.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks.filter(Boolean);
}

export function blocksToAnalysisPoints(
  blocks: Array<{
    sourceType: 'prompt' | 'file';
    sourceLabel: string;
    fileName?: string;
    location: Record<string, unknown>;
    text: string;
  }>,
  maxPoints: number
): AnalysisPoint[] {
  const points: AnalysisPoint[] = [];

  for (const block of blocks) {
    const candidates = splitTextIntoCandidatePoints(block.text);

    candidates.forEach((candidate, index) => {
      points.push({
        pointId: `point-${points.length + 1}`,
        sourceType: block.sourceType,
        sourceLabel: block.sourceLabel,
        userFileName: block.fileName,
        location: { ...block.location, point: index + 1 },
        userWording: candidate
      });
    });
  }

  return points.slice(0, maxPoints);
}

export function buildNotExtractableRow(fileName: string, location: Record<string, unknown>): AssessmentResultRow {
  return {
    matchId: `not-extractable-${fileName}-${Math.random().toString(36).slice(2, 7)}`,
    matchStatus: 'NOT_EXTRACTABLE',
    isExactMatch: false,
    userSourceType: 'file',
    userFileName: fileName,
    userLocation: location,
    userWording: '',
    vectorStoreId: '-',
    vectorStoreSourceFile: '-',
    matchedVectorStoreWording: '-',
    similarityScore: '-',
    nistAiRmfFunction: 'Manage',
    governanceInterpretation: 'The file was uploaded, but readable text could not be extracted.',
    riskGap: 'This file cannot be compared against the vector stores because no readable text was extracted.',
    recommendation: 'Convert the document to PDF, DOCX, XLSX, TXT, CSV, Markdown, or another text-readable format, then upload again.'
  };
}

export function getBestMatch(matches: StoreMatch[]) {
  return [...matches].sort((a, b) => b.score - a.score)[0];
}

export function buildResultRow(params: {
  matchId: string;
  point: AnalysisPoint;
  match?: StoreMatch;
  status: 'MATCHING' | 'POSSIBLE_MATCH_NOT_IDENTICAL' | 'NOT_MATCHED';
  isExactMatch: boolean;
}): AssessmentResultRow {
  const rmf = classifyRmf(params.point.userWording);
  const score = params.match?.score ?? 0;

  return {
    matchId: params.matchId,
    matchStatus: params.status,
    isExactMatch: params.isExactMatch,
    userSourceType: params.point.sourceType,
    userFileName: params.point.userFileName ?? '-',
    userLocation: params.point.location,
    userWording: params.point.userWording,
    vectorStoreId: params.match?.vectorStoreId ?? '-',
    vectorStoreSourceFile: params.match?.sourceFile ?? '-',
    matchedVectorStoreWording: params.match?.matchedText ?? '-',
    similarityScore: params.match ? Number(score.toFixed(4)) : '-',
    nistAiRmfFunction: rmf,
    governanceInterpretation: interpretationForMatch(params.isExactMatch, score, rmf),
    riskGap: params.isExactMatch
      ? 'No gap flagged for this point because identical or near-identical evidence was retrieved.'
      : 'No identical evidence was retrieved for this point.',
    recommendation: params.isExactMatch
      ? 'Keep this evidence traceable. A human reviewer should confirm that the matched wording remains current and applicable.'
      : recommendationForUnmatched(params.point.userWording, params.match)
  };
}
