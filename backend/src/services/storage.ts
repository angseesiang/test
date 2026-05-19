import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { AuditLog, DatabaseShape, PublicUser, User } from '../types';

const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'db.json');

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function publicUser(user: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = user;
  return rest;
}

function defaultDb(): DatabaseShape {
  const now = new Date().toISOString();

  return {
    users: [
      {
        id: 'usr_default_admin',
        name: 'Default Admin',
        email: 'admin@example.com',
        passwordHash: bcrypt.hashSync('password', 10),
        role: 'admin',
        status: 'active',
        joinedAt: now
      },
      {
        id: 'usr_default_user',
        name: 'User',
        email: 'user@example.com',
        passwordHash: bcrypt.hashSync('password', 10),
        role: 'user',
        status: 'active',
        joinedAt: now
      }
    ],
    assessments: [],
    auditLogs: []
  };
}

function ensureDb() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultDb(), null, 2));
  }
}

export function readDb(): DatabaseShape {
  ensureDb();
  const raw = fs.readFileSync(dbPath, 'utf8');
  return JSON.parse(raw) as DatabaseShape;
}

export function writeDb(db: DatabaseShape) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

export function listPublicUsers() {
  return readDb().users.map(publicUser);
}

export function getUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return readDb().users.find((user) => user.email.toLowerCase() === normalized);
}

export function getUserById(userId: string) {
  return readDb().users.find((user) => user.id === userId);
}

export function createUser(input: {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'user';
}) {
  const db = readDb();
  const email = input.email.trim().toLowerCase();

  if (db.users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error('A user with this email already exists.');
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
  writeDb(db);

  return publicUser(user);
}

export function updateUser(userId: string, input: Partial<Pick<User, 'name' | 'email' | 'role' | 'status'>>) {
  const db = readDb();
  const user = db.users.find((item) => item.id === userId);

  if (!user) throw new Error('User not found.');

  if (input.email) {
    const email = input.email.trim().toLowerCase();
    const exists = db.users.some((item) => item.id !== userId && item.email.toLowerCase() === email);
    if (exists) throw new Error('Another user with this email already exists.');
    user.email = email;
  }

  if (input.name) user.name = input.name.trim();
  if (input.role) user.role = input.role;
  if (input.status) user.status = input.status;

  writeDb(db);
  return publicUser(user);
}

export function deleteUser(userId: string) {
  const db = readDb();
  const before = db.users.length;
  db.users = db.users.filter((user) => user.id !== userId);

  if (db.users.length === before) throw new Error('User not found.');

  writeDb(db);
}

export function appendAuditLog(input: Omit<AuditLog, 'id' | 'createdAt'>) {
  const db = readDb();
  const log: AuditLog = {
    ...input,
    id: createId('aud'),
    createdAt: new Date().toISOString()
  };
  db.auditLogs.unshift(log);
  db.auditLogs = db.auditLogs.slice(0, 1000);
  writeDb(db);
  return log;
}

export function getAuditLogs() {
  return readDb().auditLogs;
}

export function createAssessmentRecord(assessment: DatabaseShape['assessments'][number]) {
  const db = readDb();
  db.assessments.unshift(assessment);
  writeDb(db);
  return assessment;
}

export function listAssessments() {
  return readDb().assessments;
}

export function getAssessmentById(assessmentId: string) {
  return readDb().assessments.find((assessment) => assessment.id === assessmentId);
}

export { createId, publicUser };
