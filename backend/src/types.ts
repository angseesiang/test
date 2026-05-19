export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'disabled';

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  joinedAt: string;
};

export type PublicUser = Omit<User, 'passwordHash'>;

export type RmfFunction = 'Govern' | 'Map' | 'Measure' | 'Manage';

export type AssessmentMaturity = 'Initial' | 'Developing' | 'Defined' | 'Managed' | 'Optimized';

export type MatchStatus = 'MATCHING' | 'POSSIBLE_MATCH_NOT_IDENTICAL' | 'NOT_MATCHED' | 'NOT_EXTRACTABLE';

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
  maturity: AssessmentMaturity;
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

export type AuditLog = {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type DatabaseShape = {
  users: User[];
  assessments: Assessment[];
  auditLogs: AuditLog[];
};
