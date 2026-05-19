export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'disabled';

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  joinedAt: string;
};

export type RmfFunction = 'Govern' | 'Map' | 'Measure' | 'Manage';
export type MatchStatus = 'MATCHING' | 'POSSIBLE_MATCH_NOT_IDENTICAL' | 'NOT_MATCHED' | 'NOT_EXTRACTABLE';
export type Maturity = 'Initial' | 'Developing' | 'Defined' | 'Managed' | 'Optimized';

export type AssessmentResultRow = {
  matchId: string;
  matchStatus: MatchStatus;
  isExactMatch: boolean;
  userSourceType: 'prompt' | 'file';
  userFileName: string;
  userLocation: Record<string, unknown>;
  userWording: string;
  vectorStoreId: string;
  vectorStoreSourceFile: string;
  matchedVectorStoreWording: string;
  similarityScore: number | string;
  nistAiRmfFunction: RmfFunction;
  governanceInterpretation: string;
  riskGap: string;
  recommendation: string;
};

export type AssessmentSummary = {
  uploadedFiles: number;
  extractedPointCount: number;
  matchingCount: number;
  possibleMatchCount: number;
  notMatchedCount: number;
  notExtractableCount: number;
  governScore: number;
  mapScore: number;
  measureScore: number;
  manageScore: number;
  averageScore: number;
  maturity: Maturity;
};

export type Assessment = {
  id: string;
  ownerUserId: string;
  date: string;
  title: string;
  systemDescription: string;
  uploadedFileNames: string[];
  summary: AssessmentSummary;
  rows: AssessmentResultRow[];
};
