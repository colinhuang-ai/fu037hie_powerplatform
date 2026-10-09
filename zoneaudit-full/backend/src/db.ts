import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export const ROLES = ['admin', 'auditor', 'fixer'] as const;
export type Role = (typeof ROLES)[number];

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  hasPassword: boolean;
  createdAt: string;
  lastLogin: string | null;
}

interface UserRow extends User {
  passwordHash: string | null;
  googleSub: string | null;
}

export type DraftAnswerResult = 'pass' | 'fail' | 'na';
export interface DraftAnswer {
  result: DraftAnswerResult | null;
  note?: string;
  severity?: string;
  photo?: string | null;
  assignedTo?: string | null;
  dueDate?: string | null;
}
export interface DraftItem {
  id: string;
  title: string;
  order: number;
}
export interface Draft {
  id: string;
  ownerId: string;
  zoneId: string;
  zoneTitle: string;
  templateId: string;
  templateTitle: string;
  items: DraftItem[];
  answers: Record<string, DraftAnswer>;
  createdAt: string;
  updatedAt: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','auditor','fixer')),
  password_hash TEXT,
  google_sub TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login TEXT
);
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  zone_id TEXT NOT NULL,
  zone_title TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_title TEXT NOT NULL,
  items_json TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS drafts_owner ON drafts(owner_id);
`;

type Row = Record<string, any>;

const toUser = (r: Row): UserRow => ({
  id: r.id,
  email: r.email,
  name: r.name,
  role: r.role,
  active: !!r.active,
  hasPassword: !!r.password_hash,
  createdAt: r.created_at,
  lastLogin: r.last_login,
  passwordHash: r.password_hash,
  googleSub: r.google_sub,
});

const publicUser = ({ passwordHash: _p, googleSub: _g, ...u }: UserRow): User => u;

const toDraft = (r: Row): Draft => ({
  id: r.id,
  ownerId: r.owner_id,
  zoneId: r.zone_id,
  zoneTitle: r.zone_title,
  templateId: r.template_id,
  templateTitle: r.template_title,
  items: JSON.parse(r.items_json),
  answers: JSON.parse(r.answers_json),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Local store for what Dataverse has no table for: app users and in-progress audit drafts. */
export class Store {
  private db: DatabaseSync;

  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.db.exec(SCHEMA);
  }

  close() {
    this.db.close();
  }

  // ---------- users ----------
  countUsers(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  }

  listUsers(): User[] {
    return (this.db.prepare('SELECT * FROM users ORDER BY name COLLATE NOCASE').all() as Row[]).map((r) => publicUser(toUser(r)));
  }

  getUser(id: string): User | null {
    const r = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined;
    return r ? publicUser(toUser(r)) : null;
  }

  /** Includes the password hash - only for the login flow. */
  getUserForLogin(email: string): (User & { passwordHash: string | null; googleSub: string | null }) | null {
    const r = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim()) as Row | undefined;
    return r ? toUser(r) : null;
  }

  getUserWithHash(id: string): (User & { passwordHash: string | null }) | null {
    const r = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined;
    return r ? toUser(r) : null;
  }

  createUser(input: { email: string; name: string; role: Role; passwordHash?: string | null; googleSub?: string | null }): User {
    const id = randomUUID();
    this.db
      .prepare('INSERT INTO users (id, email, name, role, password_hash, google_sub, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
      .run(id, input.email.trim().toLowerCase(), input.name.trim(), input.role, input.passwordHash ?? null, input.googleSub ?? null, new Date().toISOString());
    return this.getUser(id)!;
  }

  updateUser(id: string, patch: { name?: string; role?: Role; active?: boolean; passwordHash?: string; googleSub?: string }): User | null {
    const sets: string[] = [];
    const vals: (string | number)[] = [];
    if (patch.name !== undefined) (sets.push('name = ?'), vals.push(patch.name.trim()));
    if (patch.role !== undefined) (sets.push('role = ?'), vals.push(patch.role));
    if (patch.active !== undefined) (sets.push('active = ?'), vals.push(patch.active ? 1 : 0));
    if (patch.passwordHash !== undefined) (sets.push('password_hash = ?'), vals.push(patch.passwordHash));
    if (patch.googleSub !== undefined) (sets.push('google_sub = ?'), vals.push(patch.googleSub));
    if (sets.length) this.db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    return this.getUser(id);
  }

  touchLogin(id: string) {
    this.db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), id);
  }

  countActiveAdmins(): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get() as { n: number }).n;
  }

  // ---------- drafts ----------
  listDrafts(ownerId: string): Draft[] {
    return (this.db.prepare('SELECT * FROM drafts WHERE owner_id = ? ORDER BY updated_at DESC').all(ownerId) as Row[]).map(toDraft);
  }

  getDraft(id: string): Draft | null {
    const r = this.db.prepare('SELECT * FROM drafts WHERE id = ?').get(id) as Row | undefined;
    return r ? toDraft(r) : null;
  }

  createDraft(input: Omit<Draft, 'id' | 'createdAt' | 'updatedAt' | 'answers'>): Draft {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO drafts (id, owner_id, zone_id, zone_title, template_id, template_title, items_json, answers_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(id, input.ownerId, input.zoneId, input.zoneTitle, input.templateId, input.templateTitle, JSON.stringify(input.items), '{}', now, now);
    return this.getDraft(id)!;
  }

  saveDraftAnswers(id: string, answers: Record<string, DraftAnswer>): Draft | null {
    this.db.prepare('UPDATE drafts SET answers_json = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(answers), new Date().toISOString(), id);
    return this.getDraft(id);
  }

  deleteDraft(id: string) {
    this.db.prepare('DELETE FROM drafts WHERE id = ?').run(id);
  }
}
