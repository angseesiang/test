import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import mammoth from 'mammoth';
import OpenAI from 'openai';
import { decompressSync } from 'fflate';
import * as XLSX from 'xlsx';

type KVNamespaceLike = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

type Env = {
  NIST_RMF_DB: KVNamespaceLike;

  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  VECTOR_STORE_IDS?: string;
  JWT_SECRET?: string;
  FRONTEND_ORIGIN?: string;

  MAX_FILE_MB?: string;
  MAX_FILES_PER_ASSESSMENT?: string;
  MAX_POINTS_PER_ASSESSMENT?: string;
  MIN_POSSIBLE_SCORE?: string;
  ALLOWED_MIME_TYPES?: string;

  DEFAULT_ADMIN_EMAIL?: string;
  DEFAULT_ADMIN_PASSWORD?: string;
  DEFAULT_ADMIN_NAME?: string;

  DEFAULT_USER_EMAIL?: string;
  DEFAULT_USER_PASSWORD?: string;
  DEFAULT_USER_NAME?: string;
};

type PagesContext = {
  request: Request;
  env: Env;
};

type UserRole = 'admin' | 'user';
type UserStatus = 'active' | 'disabled';

type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  joinedAt: string;
};

type PublicUser = Omit<User, 'passwordHash'>;

type RmfFunction = 'Govern' | 'Map' | 'Measure' | 'Manage';

type AssessmentMaturity = 'Initial' | 'Developing' | 'Defined' | 'Managed' | 'Optimized';

type MatchStatus = 'MATCHING' | 'POSSIBLE_MATCH_NOT_IDENTICAL' | 'NOT_MATCHED' | 'NOT_EXTRACTABLE';

type AssessmentResultRow = {
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

type AssessmentSummary = {
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

type Assessment = {
  id: string;
  ownerUserId: string;
  date: string;
  title: string;
  systemDescription: string;
  uploadedFileNames: string[];
  summary: AssessmentSummary;
  rows: AssessmentResultRow[];
};

type AuditLog = {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type DatabaseShape = {
  users: User[];
  assessments: Assessment[];
  auditLogs: AuditLog[];
};

type FileLike = {
  name: string;
  type: string;
  size: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
};

type RuntimeConfig = {
  openaiModel: string;
  vectorStoreIds: string[];
  jwtSecret: string;
  maxFileMb: number;
  maxFilesPerAssessment: number;
  maxPointsPerAssessment: number;
  minPossibleScore: number;
  allowedMimeTypes: string[];
};

type ExtractedBlock = {
  sourceType: 'prompt' | 'file';
  sourceLabel: string;
  fileName?: string;
  location: Record<string, unknown>;
  text: string;
  extractionStatus: 'extracted' | 'not_extractable';
};

type StoreMatch = {
  vectorStoreId: string;
  matchedText: string;
  sourceFile: string;
  score: number;
  raw: unknown;
};

type AnalysisPoint = {
  pointId: string;
  sourceType: 'prompt' | 'file';
  sourceLabel: string;
  userFileName?: string;
  location: Record<string, unknown>;
  userWording: string;
};

const DB_KEY = 'nist-ai-rmf-advisor:db';

const DEFAULT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx']
};

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function splitCsv(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getConfig(env: Env): RuntimeConfig {
  const configuredAllowedMimeTypes = splitCsv(env.ALLOWED_MIME_TYPES);

  return {
    openaiModel: env.OPENAI_MODEL ?? 'gpt-5.5',
    vectorStoreIds: splitCsv(env.VECTOR_STORE_IDS),
    jwtSecret: env.JWT_SECRET ?? 'local-development-secret-change-me',
    maxFileMb: numberFromEnv(env.MAX_FILE_MB, 20),
    maxFilesPerAssessment: numberFromEnv(env.MAX_FILES_PER_ASSESSMENT, 20),
    maxPointsPerAssessment: numberFromEnv(env.MAX_POINTS_PER_ASSESSMENT, 250),
    minPossibleScore: numberFromEnv(env.MIN_POSSIBLE_SCORE, 0.7),
    allowedMimeTypes: configuredAllowedMimeTypes.length ? configuredAllowedMimeTypes : DEFAULT_ALLOWED_MIME_TYPES
  };
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function publicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

function getAllowedOrigin(request: Request, env: Env) {
  const requestOrigin = request.headers.get('Origin') ?? '';
  const configured = (env.FRONTEND_ORIGIN ?? '*').trim();

  if (!configured || configured === '*') {
    return requestOrigin || '*';
  }

  const allowedOrigins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0] || requestOrigin || '*';
}

function responseHeaders(request: Request, env: Env) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(request, env),
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin'
  };
}

function jsonResponse(request: Request, env: Env, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request, env)
  });
}

function emptyResponse(request: Request, env: Env, status = 204) {
  return new Response(null, {
    status,
    headers: {
      'Access-Control-Allow-Origin': getAllowedOrigin(request, env),
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      Vary: 'Origin'
    }
  });
}

async function parseJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch (_error) {
    return {};
  }
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getDbBinding(env: Env) {
  if (!env.NIST_RMF_DB) {
    throw new ApiError(500, 'Cloudflare KV binding NIST_RMF_DB is not configured.');
  }

  return env.NIST_RMF_DB;
}

function defaultDb(env: Env): DatabaseShape {
  const now = new Date().toISOString();

  const adminPassword = env.DEFAULT_ADMIN_PASSWORD ?? 'password';
  const defaultUserPassword = env.DEFAULT_USER_PASSWORD ?? 'password';

  return {
    users: [
      {
        id: 'usr_default_admin',
        name: env.DEFAULT_ADMIN_NAME ?? 'Default Admin',
        email: (env.DEFAULT_ADMIN_EMAIL ?? 'admin@example.com').trim().toLowerCase(),
        passwordHash: bcrypt.hashSync(adminPassword, 10),
        role: 'admin',
        status: 'active',
        joinedAt: now
      },
      {
        id: 'usr_default_user',
        name: env.DEFAULT_USER_NAME ?? 'User',
        email: (env.DEFAULT_USER_EMAIL ?? 'user@example.com').trim().toLowerCase(),
        passwordHash: bcrypt.hashSync(defaultUserPassword, 10),
        role: 'user',
        status: 'active',
        joinedAt: now
      }
    ],
    assessments: [],
    auditLogs: []
  };
}

async function readDb(env: Env): Promise<DatabaseShape> {
  const kv = getDbBinding(env);
  const raw = await kv.get(DB_KEY);

  if (!raw) {
    const freshDb = defaultDb(env);
    await writeDb(env, freshDb);
    return freshDb;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DatabaseShape>;

    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      assessments: Array.isArray(parsed.assessments) ? parsed.assessments : [],
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : []
    };
  } catch (_error) {
    throw new ApiError(500, 'Stored Cloudflare KV database is not valid JSON.');
  }
}

async function writeDb(env: Env, db: DatabaseShape) {
  const kv = getDbBinding(env);
  await kv.put(DB_KEY, JSON.stringify(db));
}

async function listPublicUsers(env: Env) {
  const db = await readDb(env);
  return db.users.map(publicUser);
}

async function getUserByEmail(env: Env, email: string) {
  const db = await readDb(env);
  const normalized = email.trim().toLowerCase();
  return db.users.find((user) => user.email.toLowerCase() === normalized);
}

async function getUserById(env: Env, userId: string) {
  const db = await readDb(env);
  return db.users.find((user) => user.id === userId);
}

async function createUser(
  env: Env,
  input: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
  }
) {
  const db = await readDb(env);
  const email = input.email.trim().toLowerCase();

  if (db.users.some((user) => user.email.toLowerCase() === email)) {
    throw new ApiError(400, 'A user with this email already exists.');
  }

  const user: User = {
    id: createId('usr'),
    name: input.name.trim(),
    email,
    passwordHash: bcrypt.hashSync(input.password, 10),
    role: input.role ?? 'user',
    status: 'active',
    joinedAt: new Date().toISOString()
  };

  db.users.push(user);
  await writeDb(env, db);

  return publicUser(user);
}

async function updateUser(
  env: Env,
  userId: string,
  input: Partial<Pick<User, 'name' | 'email' | 'role' | 'status'>>
) {
  const db = await readDb(env);
  const user = db.users.find((item) => item.id === userId);

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  if (input.email) {
    const email = input.email.trim().toLowerCase();
    const exists = db.users.some((item) => item.id !== userId && item.email.toLowerCase() === email);

    if (exists) {
      throw new ApiError(400, 'Another user with this email already exists.');
    }

    user.email = email;
  }

  if (input.name) user.name = input.name.trim();
  if (input.role) user.role = input.role;
  if (input.status) user.status = input.status;

  await writeDb(env, db);

  return publicUser(user);
}

async function deleteUser(env: Env, userId: string) {
  const db = await readDb(env);
  const before = db.users.length;

  db.users = db.users.filter((user) => user.id !== userId);

  if (db.users.length === before) {
    throw new ApiError(404, 'User not found.');
  }

  await writeDb(env, db);
}

async function appendAuditLog(env: Env, input: Omit<AuditLog, 'id' | 'createdAt'>) {
  const db = await readDb(env);

  const log: AuditLog = {
    ...input,
    id: createId('aud'),
    createdAt: new Date().toISOString()
  };

  db.auditLogs.unshift(log);
  db.auditLogs = db.auditLogs.slice(0, 1000);

  await writeDb(env, db);

  return log;
}

async function getAuditLogs(env: Env) {
  const db = await readDb(env);
  return db.auditLogs;
}

async function createAssessmentRecord(env: Env, assessment: Assessment) {
  const db = await readDb(env);
  db.assessments.unshift(assessment);
  await writeDb(env, db);
  return assessment;
}

async function listAssessments(env: Env) {
  const db = await readDb(env);
  return db.assessments;
}

async function getAssessmentById(env: Env, assessmentId: string) {
  const db = await readDb(env);
  return db.assessments.find((assessment) => assessment.id === assessmentId);
}

function jwtKey(config: RuntimeConfig) {
  return new TextEncoder().encode(config.jwtSecret);
}

async function signToken(env: Env, userId: string) {
  const config = getConfig(env);

  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(jwtKey(config));
}

function getBearerToken(request: Request) {
  const header = request.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length);
}

async function requireAuth(request: Request, env: Env) {
  const token = getBearerToken(request);

  if (!token) {
    throw new ApiError(401, 'Missing authentication token.');
  }

  try {
    const config = getConfig(env);
    const { payload } = await jwtVerify(token, jwtKey(config));
    const userId = typeof payload.userId === 'string' ? payload.userId : '';

    const user = await getUserById(env, userId);

    if (!user || user.status !== 'active') {
      throw new ApiError(401, 'User is not active or does not exist.');
    }

    return publicUser(user);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Invalid or expired authentication token.');
  }
}

function requireAdmin(user: PublicUser) {
  if (user.role !== 'admin') {
    throw new ApiError(403, 'Admin access is required.');
  }
}

function cleanText(input: string) {
  return input
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isMostlyReadableText(text: string) {
  const cleaned = text.trim();
  if (!cleaned) return false;

  const sample = cleaned.slice(0, 5000);
  let readable = 0;
  let replacementCharacters = 0;

  for (const ch of sample) {
    const code = ch.charCodeAt(0);

    if (ch === '\uFFFD') {
      replacementCharacters += 1;
    }

    if (
      ch === '\n' ||
      ch === '\r' ||
      ch === '\t' ||
      (code >= 32 && code <= 126) ||
      (code >= 0x00a0 && code <= 0xffff)
    ) {
      readable += 1;
    }
  }

  const hasUsefulCharacters = /[A-Za-z0-9]/.test(sample);
  const readableRatio = readable / sample.length;
  const replacementRatio = replacementCharacters / sample.length;

  return hasUsefulCharacters && readableRatio > 0.85 && replacementRatio < 0.05;
}

function getExtension(fileName: string) {
  const lastSegment = fileName.split('.').pop();
  return lastSegment ? lastSegment.toLowerCase() : '';
}

function allowedExtensionsForMimeTypes(allowedMimeTypes: string[]) {
  const extensions = new Set<string>();

  for (const mimeType of allowedMimeTypes) {
    for (const ext of MIME_TO_EXTENSIONS[mimeType] ?? []) {
      extensions.add(ext);
    }
  }

  return extensions;
}

function isAllowedUpload(file: FileLike, config: RuntimeConfig) {
  if (!config.allowedMimeTypes.length) return true;

  const normalizedMimeType = (file.type ?? '').trim().toLowerCase();
  const ext = getExtension(file.name);
  const allowedExtensions = allowedExtensionsForMimeTypes(config.allowedMimeTypes);

  const mimeTypeAllowed = normalizedMimeType ? config.allowedMimeTypes.includes(normalizedMimeType) : false;
  const extensionAllowed = ext ? allowedExtensions.has(ext) : false;

  return mimeTypeAllowed || extensionAllowed;
}

async function extractReadableTextFromFile(file: FileLike) {
  const text = cleanText(await file.text());
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

function bytesToLatin1(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  let output = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, Math.min(index + chunkSize, bytes.length));
    output += String.fromCharCode(...chunk);
  }

  return output;
}

function decodePdfStringBytes(bytes: number[]) {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let output = '';

    for (let index = 2; index + 1 < bytes.length; index += 2) {
      output += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
    }

    return output;
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    let output = '';

    for (let index = 2; index + 1 < bytes.length; index += 2) {
      output += String.fromCharCode(bytes[index] | (bytes[index + 1] << 8));
    }

    return output;
  }

  return String.fromCharCode(...bytes);
}

function readPdfLiteralString(input: string, startIndex: number) {
  const bytes: number[] = [];
  let index = startIndex + 1;
  let depth = 1;

  while (index < input.length && depth > 0) {
    const char = input[index];

    if (char === '\\') {
      const next = input[index + 1];

      if (next === undefined) {
        index += 1;
        continue;
      }

      if (next === 'n') bytes.push(10);
      else if (next === 'r') bytes.push(13);
      else if (next === 't') bytes.push(9);
      else if (next === 'b') bytes.push(8);
      else if (next === 'f') bytes.push(12);
      else if (next === '(' || next === ')' || next === '\\') bytes.push(next.charCodeAt(0));
      else if (next === '\r' || next === '\n') {
        if (next === '\r' && input[index + 2] === '\n') index += 1;
      } else if (/[0-7]/.test(next)) {
        let octal = next;
        let consumed = 1;

        while (consumed < 3 && /[0-7]/.test(input[index + 1 + consumed] ?? '')) {
          octal += input[index + 1 + consumed];
          consumed += 1;
        }

        bytes.push(parseInt(octal, 8) & 0xff);
        index += consumed - 1;
      } else {
        bytes.push(next.charCodeAt(0) & 0xff);
      }

      index += 2;
      continue;
    }

    if (char === '(') {
      depth += 1;
      bytes.push(char.charCodeAt(0));
      index += 1;
      continue;
    }

    if (char === ')') {
      depth -= 1;

      if (depth > 0) {
        bytes.push(char.charCodeAt(0));
      }

      index += 1;
      continue;
    }

    bytes.push(char.charCodeAt(0) & 0xff);
    index += 1;
  }

  return {
    value: decodePdfStringBytes(bytes),
    endIndex: index
  };
}

function readPdfHexString(input: string, startIndex: number) {
  const endIndex = input.indexOf('>', startIndex + 1);

  if (endIndex === -1) {
    return { value: '', endIndex: startIndex + 1 };
  }

  let hex = input.slice(startIndex + 1, endIndex).replace(/\s+/g, '');

  if (!/^[\da-fA-F]*$/.test(hex)) {
    return { value: '', endIndex: endIndex + 1 };
  }

  if (hex.length % 2 === 1) {
    hex += '0';
  }

  const bytes: number[] = [];

  for (let index = 0; index < hex.length; index += 2) {
    bytes.push(parseInt(hex.slice(index, index + 2), 16));
  }

  return {
    value: decodePdfStringBytes(bytes),
    endIndex: endIndex + 1
  };
}

function extractTextFromPdfTextObject(textObject: string) {
  const pieces: string[] = [];
  let index = 0;

  while (index < textObject.length) {
    const char = textObject[index];

    if (char === '(') {
      const parsed = readPdfLiteralString(textObject, index);
      if (parsed.value.trim()) pieces.push(parsed.value);
      index = parsed.endIndex;
      continue;
    }

    if (char === '<' && textObject[index + 1] !== '<') {
      const parsed = readPdfHexString(textObject, index);
      if (parsed.value.trim()) pieces.push(parsed.value);
      index = parsed.endIndex;
      continue;
    }

    index += 1;
  }

  return pieces.join(' ');
}

function extractTextFromPdfContentStream(content: string) {
  const textObjects = content.match(/BT[\s\S]*?ET/g) ?? [];

  return cleanText(
    textObjects
      .map((textObject) => textObject.replace(/^BT/, '').replace(/ET$/, ''))
      .map(extractTextFromPdfTextObject)
      .filter(Boolean)
      .join('\n')
  );
}

function decodePdfStreamBytes(dictionary: string, streamBytes: Uint8Array) {
  if (/\/FlateDecode\b|\/Fl\b/.test(dictionary)) {
    return decompressSync(streamBytes);
  }

  return streamBytes;
}

async function extractPdfTextBlocks(file: FileLike): Promise<ExtractedBlock[]> {
  const fileName = file.name;

  try {
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const pdfBinary = bytesToLatin1(pdfBytes);
    const blocks: ExtractedBlock[] = [];

    let searchIndex = 0;
    let streamNumber = 0;

    while (searchIndex < pdfBinary.length) {
      const streamKeywordIndex = pdfBinary.indexOf('stream', searchIndex);
      if (streamKeywordIndex === -1) break;

      const dictionaryStart = pdfBinary.lastIndexOf('<<', streamKeywordIndex);
      const dictionary = dictionaryStart >= 0 ? pdfBinary.slice(dictionaryStart, streamKeywordIndex) : '';

      let streamStart = streamKeywordIndex + 'stream'.length;

      if (pdfBinary[streamStart] === '\r' && pdfBinary[streamStart + 1] === '\n') {
        streamStart += 2;
      } else if (pdfBinary[streamStart] === '\n' || pdfBinary[streamStart] === '\r') {
        streamStart += 1;
      }

      const streamEnd = pdfBinary.indexOf('endstream', streamStart);
      if (streamEnd === -1) break;

      streamNumber += 1;

      try {
        const rawStreamBytes = pdfBytes.subarray(streamStart, streamEnd);
        const decodedStreamBytes = decodePdfStreamBytes(dictionary, rawStreamBytes);
        const decodedStream = bytesToLatin1(decodedStreamBytes);
        const text = extractTextFromPdfContentStream(decodedStream);

        if (text) {
          blocks.push({
            sourceType: 'file',
            sourceLabel: fileName,
            fileName,
            location: {
              file: fileName,
              stream: streamNumber,
              extraction: 'cloudflare-safe pdf content stream parser'
            },
            text,
            extractionStatus: 'extracted'
          });
        }
      } catch (_streamError) {
        // Some PDF streams contain images, fonts, or unsupported compression filters.
        // Skip those streams and keep scanning for readable text streams.
      }

      searchIndex = streamEnd + 'endstream'.length;
    }

    if (blocks.length) {
      return blocks;
    }

    return [
      {
        sourceType: 'file',
        sourceLabel: fileName,
        fileName,
        location: {
          file: fileName,
          documentType: 'pdf',
          extraction: 'cloudflare-safe pdf content stream parser',
          reason:
            'No readable PDF text stream was found. This may be a scanned PDF, image-only PDF, or a PDF using a custom font encoding without embedded readable text.'
        },
        text: '',
        extractionStatus: 'not_extractable'
      }
    ];
  } catch (error) {
    return [
      {
        sourceType: 'file',
        sourceLabel: fileName,
        fileName,
        location: {
          file: fileName,
          documentType: 'pdf',
          extraction: 'cloudflare-safe pdf content stream parser',
          extractionError: error instanceof Error ? error.message : 'Unknown PDF extraction error'
        },
        text: '',
        extractionStatus: 'not_extractable'
      }
    ];
  }
}

async function extractAnyFileText(file: FileLike): Promise<ExtractedBlock[]> {
  const fileName = file.name;
  const ext = getExtension(fileName);

  try {
    if (ext === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer } as any);
      const text = cleanText(result.value ?? '');

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

    if (['xls', 'xlsx'].includes(ext)) {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const blocks: ExtractedBlock[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: false,
          defval: ''
        }) as unknown[][];

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

    if (ext === 'pdf') {
      return extractPdfTextBlocks(file);
    }

    const text = await extractReadableTextFromFile(file);

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
    const text = await extractReadableTextFromFile(file).catch(() => '');

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

function getOpenAI(env: Env) {
  const apiKey = env.OPENAI_API_KEY ?? '';

  if (!apiKey || apiKey.includes('your-openai-api-key')) {
    return null;
  }

  return new OpenAI({ apiKey });
}

async function searchAllVectorStores(env: Env, query: string, storeIds: string[], topN = 5): Promise<StoreMatch[]> {
  const results: StoreMatch[] = [];
  const openai = getOpenAI(env);

  if (!openai || !storeIds.length || !query.trim()) {
    return results;
  }

  for (const vectorStoreId of storeIds) {
    try {
      const response = await (openai as any).vectorStores.search(vectorStoreId, {
        query,
        max_num_results: topN
      });

      for (const item of response.data ?? []) {
        results.push({
          vectorStoreId,
          matchedText: extractContentText(item),
          sourceFile: item.filename ?? item.file_id ?? '-',
          score: Number(item.score ?? 0),
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

function isIdenticalOrNearIdentical(userText: string, storeText: string) {
  const userNorm = normalizeForCompare(userText);
  const storeNorm = normalizeForCompare(storeText);

  if (!userNorm || !storeNorm) return false;
  if (storeNorm.includes(userNorm) && userNorm.length >= 40) return true;
  if (userNorm.includes(storeNorm) && storeNorm.length >= 80) return true;

  return jaccardSimilarity(userText, storeText) >= 0.92;
}

function classifyRmf(text: string): RmfFunction {
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

function recommendationForUnmatched(config: RuntimeConfig, userText: string, bestMatch?: StoreMatch) {
  const rmf = classifyRmf(userText);

  if (bestMatch && bestMatch.score >= config.minPossibleScore) {
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

function interpretationForMatch(config: RuntimeConfig, isExact: boolean, score: number, rmf: RmfFunction) {
  if (isExact) {
    return `Identical or near-identical wording was found. Treat this as matched evidence for ${rmf}, subject to human review.`;
  }

  if (score >= config.minPossibleScore) {
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

function blocksToAnalysisPoints(
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

function buildNotExtractableRow(fileName: string, location: Record<string, unknown>): AssessmentResultRow {
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

function getBestMatch(matches: StoreMatch[]) {
  return [...matches].sort((a, b) => b.score - a.score)[0];
}

function buildResultRow(
  config: RuntimeConfig,
  params: {
    matchId: string;
    point: AnalysisPoint;
    match?: StoreMatch;
    status: 'MATCHING' | 'POSSIBLE_MATCH_NOT_IDENTICAL' | 'NOT_MATCHED';
    isExactMatch: boolean;
  }
): AssessmentResultRow {
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
    governanceInterpretation: interpretationForMatch(config, params.isExactMatch, score, rmf),
    riskGap: params.isExactMatch
      ? 'No gap flagged for this point because identical or near-identical evidence was retrieved.'
      : 'No identical evidence was retrieved for this point.',
    recommendation: params.isExactMatch
      ? 'Keep this evidence traceable. A human reviewer should confirm that the matched wording remains current and applicable.'
      : recommendationForUnmatched(config, params.point.userWording, params.match)
  };
}

function maturityFromScore(score: number): AssessmentMaturity {
  if (score >= 85) return 'Optimized';
  if (score >= 70) return 'Managed';
  if (score >= 50) return 'Defined';
  if (score >= 25) return 'Developing';
  return 'Initial';
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

async function generateAssessmentFromInput(env: Env, input: { systemDescription: string; files: FileLike[] }) {
  const config = getConfig(env);
  const blocks: ExtractedBlock[] = [];
  const rows: AssessmentResultRow[] = [];

  blocks.push(...createPromptBlock(input.systemDescription));

  for (const file of input.files) {
    const extractedBlocks = await extractAnyFileText(file);

    for (const block of extractedBlocks) {
      if (block.extractionStatus === 'extracted' && block.text.trim()) {
        blocks.push(block);
      } else {
        rows.push(buildNotExtractableRow(file.name, block.location));
      }
    }
  }

  const points = blocksToAnalysisPoints(blocks, config.maxPointsPerAssessment);

  for (const point of points) {
    const matches = await searchAllVectorStores(env, point.userWording, config.vectorStoreIds, 5);
    const exactMatches = matches.filter((match) => isIdenticalOrNearIdentical(point.userWording, match.matchedText));

    if (exactMatches.length > 0) {
      exactMatches.forEach((match, index) => {
        rows.push(
          buildResultRow(config, {
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

    if (bestMatch && bestMatch.score >= config.minPossibleScore) {
      rows.push(
        buildResultRow(config, {
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
      buildResultRow(config, {
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

function titleFromDescription(description: string, files: FileLike[]) {
  const cleaned = description.replace(/\s+/g, ' ').trim();

  if (cleaned) {
    return cleaned.length > 95 ? `${cleaned.slice(0, 95)}...` : cleaned;
  }

  if (files.length === 1) return files[0].name;
  if (files.length > 1) return `${files.length} uploaded documents`;

  return 'Untitled assessment';
}

function isFileLike(value: unknown): value is FileLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'size' in value &&
    'arrayBuffer' in value &&
    'text' in value
  );
}

async function handleAuth(request: Request, env: Env, segments: string[]) {
  const action = segments[1];

  if (request.method === 'POST' && action === 'signup') {
    const body = await parseJsonBody(request);
    const name = getString(body.name);
    const email = getString(body.email);
    const password = getString(body.password);

    if (!name || !email || !password) {
      throw new ApiError(400, 'Name, email, and password are required.');
    }

    if (password.length < 6) {
      throw new ApiError(400, 'Password must be at least 6 characters.');
    }

    const user = await createUser(env, {
      name,
      email,
      password,
      role: 'user'
    });

    const token = await signToken(env, user.id);

    await appendAuditLog(env, {
      userId: user.id,
      action: 'auth.signup',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email }
    });

    return jsonResponse(request, env, 200, { ok: true, user, token });
  }

  if (request.method === 'POST' && action === 'login') {
    const body = await parseJsonBody(request);
    const email = getString(body.email);
    const password = getString(body.password);

    const user = await getUserByEmail(env, email);

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      throw new ApiError(401, 'Invalid email or password.');
    }

    if (user.status !== 'active') {
      throw new ApiError(403, 'This account is disabled.');
    }

    const safeUser = publicUser(user);
    const token = await signToken(env, user.id);

    await appendAuditLog(env, {
      userId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email }
    });

    return jsonResponse(request, env, 200, { ok: true, user: safeUser, token });
  }

  if (request.method === 'GET' && action === 'me') {
    const user = await requireAuth(request, env);
    return jsonResponse(request, env, 200, { ok: true, user });
  }

  throw new ApiError(404, 'Auth route not found.');
}

async function handleAssessments(request: Request, env: Env, segments: string[]) {
  const user = await requireAuth(request, env);

  if (request.method === 'GET' && segments.length === 1) {
    const assessments = await listAssessments(env);

    const visibleAssessments =
      user.role === 'admin'
        ? assessments
        : assessments.filter((assessment) => assessment.ownerUserId === user.id);

    return jsonResponse(request, env, 200, { ok: true, assessments: visibleAssessments });
  }

  if (request.method === 'GET' && segments.length === 2) {
    const assessment = await getAssessmentById(env, segments[1]);

    if (!assessment) {
      throw new ApiError(404, 'Assessment not found.');
    }

    if (user.role !== 'admin' && assessment.ownerUserId !== user.id) {
      throw new ApiError(403, 'You do not have access to this assessment.');
    }

    return jsonResponse(request, env, 200, { ok: true, assessment });
  }

  if (request.method === 'POST' && segments.length === 1) {
    const config = getConfig(env);
    const formData = await request.formData();

    const systemDescriptionValue = formData.get('systemDescription');
    const systemDescription = typeof systemDescriptionValue === 'string' ? systemDescriptionValue : '';

    const files = formData.getAll('files').filter(isFileLike);

    if (files.length > config.maxFilesPerAssessment) {
      throw new ApiError(400, `Too many files. Maximum file count is ${config.maxFilesPerAssessment}.`);
    }

    const maxFileBytes = config.maxFileMb * 1024 * 1024;
    const oversized = files.find((file) => file.size > maxFileBytes);

    if (oversized) {
      throw new ApiError(400, `File too large. Maximum file size is ${config.maxFileMb} MB.`);
    }

    const unsupported = files.find((file) => !isAllowedUpload(file, config));

    if (unsupported) {
      throw new ApiError(
        400,
        `Unsupported file type for ${unsupported.name}. Allowed MIME types: ${config.allowedMimeTypes.join(', ')}.`
      );
    }

    if (!systemDescription.trim() && files.length === 0) {
      throw new ApiError(400, 'Please provide a system description or upload at least one file.');
    }

    const generated = await generateAssessmentFromInput(env, {
      systemDescription,
      files
    });

    const assessment: Assessment = {
      id: createId('ast'),
      ownerUserId: user.id,
      date: new Date().toISOString(),
      title: titleFromDescription(systemDescription, files),
      systemDescription,
      uploadedFileNames: files.map((file) => file.name),
      summary: generated.summary,
      rows: generated.rows
    };

    await createAssessmentRecord(env, assessment);

    await appendAuditLog(env, {
      userId: user.id,
      action: 'assessment.create',
      entityType: 'assessment',
      entityId: assessment.id,
      metadata: {
        uploadedFiles: files.length,
        extractedPointCount: generated.summary.extractedPointCount,
        matchingCount: generated.summary.matchingCount,
        notMatchedCount: generated.summary.notMatchedCount
      }
    });

    return jsonResponse(request, env, 200, { ok: true, assessment });
  }

  throw new ApiError(404, 'Assessment route not found.');
}

async function handleUsers(request: Request, env: Env, segments: string[]) {
  const currentUser = await requireAuth(request, env);
  requireAdmin(currentUser);

  if (request.method === 'GET' && segments.length === 2 && segments[1] === 'audit-logs') {
    return jsonResponse(request, env, 200, { ok: true, auditLogs: await getAuditLogs(env) });
  }

  if (request.method === 'GET' && segments.length === 1) {
    return jsonResponse(request, env, 200, { ok: true, users: await listPublicUsers(env) });
  }

  if (request.method === 'POST' && segments.length === 1) {
    const body = await parseJsonBody(request);

    const name = getString(body.name);
    const email = getString(body.email);
    const password = getString(body.password);
    const role = body.role === 'admin' ? 'admin' : 'user';

    if (!name || !email || !password) {
      throw new ApiError(400, 'Name, email, and password are required.');
    }

    const user = await createUser(env, {
      name,
      email,
      password,
      role
    });

    await appendAuditLog(env, {
      userId: currentUser.id,
      action: 'user.create',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email, role: user.role }
    });

    return jsonResponse(request, env, 200, { ok: true, user });
  }

  if (request.method === 'PATCH' && segments.length === 2) {
    const body = await parseJsonBody(request);
    const input: Partial<Pick<User, 'name' | 'email' | 'role' | 'status'>> = {};

    if (typeof body.name === 'string') input.name = body.name;
    if (typeof body.email === 'string') input.email = body.email;
    if (body.role === 'admin' || body.role === 'user') input.role = body.role;
    if (body.status === 'active' || body.status === 'disabled') input.status = body.status;

    const user = await updateUser(env, segments[1], input);

    await appendAuditLog(env, {
      userId: currentUser.id,
      action: 'user.update',
      entityType: 'user',
      entityId: user.id,
      metadata: { updatedFields: Object.keys(input) }
    });

    return jsonResponse(request, env, 200, { ok: true, user });
  }

  if (request.method === 'PATCH' && segments.length === 3 && segments[2] === 'disable') {
    const body = await parseJsonBody(request);
    const status = body.status === 'active' ? 'active' : 'disabled';

    const user = await updateUser(env, segments[1], { status });

    await appendAuditLog(env, {
      userId: currentUser.id,
      action: status === 'disabled' ? 'user.disable' : 'user.enable',
      entityType: 'user',
      entityId: user.id,
      metadata: { status }
    });

    return jsonResponse(request, env, 200, { ok: true, user });
  }

  if (request.method === 'DELETE' && segments.length === 2) {
    const userId = segments[1];

    if (currentUser.id === userId) {
      throw new ApiError(400, 'You cannot delete your own account while logged in.');
    }

    await deleteUser(env, userId);

    await appendAuditLog(env, {
      userId: currentUser.id,
      action: 'user.delete',
      entityType: 'user',
      entityId: userId,
      metadata: {}
    });

    return jsonResponse(request, env, 200, { ok: true });
  }

  throw new ApiError(404, 'User route not found.');
}

async function routeRequest(request: Request, env: Env) {
  const url = new URL(request.url);
  const pathWithoutApiPrefix = url.pathname.replace(/^\/api\/?/, '');
  const segments = pathWithoutApiPrefix.split('/').filter(Boolean);

  if (request.method === 'GET' && segments[0] === 'health') {
    const config = getConfig(env);
    const openaiConfigured = Boolean(
      env.OPENAI_API_KEY &&
        env.OPENAI_API_KEY.trim() &&
        !env.OPENAI_API_KEY.includes('your-openai-api-key')
    );

    return jsonResponse(request, env, 200, {
      ok: true,
      service: 'NIST AI RMF Advisor API',
      runtime: 'cloudflare-pages-functions',
      openaiConfigured,
      vectorStoreCount: config.vectorStoreIds.length,
      maxFileMb: config.maxFileMb,
      allowedMimeTypes: config.allowedMimeTypes
    });
  }

  if (segments[0] === 'auth') {
    return handleAuth(request, env, segments);
  }

  if (segments[0] === 'assessments') {
    return handleAssessments(request, env, segments);
  }

  if (segments[0] === 'users') {
    return handleUsers(request, env, segments);
  }

  throw new ApiError(404, 'API route not found.');
}

export const onRequest = async (context: PagesContext) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return emptyResponse(request, env);
  }

  try {
    return await routeRequest(request, env);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonResponse(request, env, error.status, {
        ok: false,
        message: error.message
      });
    }

    return jsonResponse(request, env, 500, {
      ok: false,
      message: error instanceof Error ? error.message : 'Unexpected server error.'
    });
  }
};