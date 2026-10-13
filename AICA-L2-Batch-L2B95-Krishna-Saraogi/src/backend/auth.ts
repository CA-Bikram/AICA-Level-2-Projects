/**
 * OneHR Payroll Manager - Authentication, roles and audit trail
 *
 * - Users are stored in SQLite with scrypt-hashed passwords.
 * - Sessions are held in memory and sent as an HttpOnly cookie (users sign in again after a restart).
 * - Three roles give maker-checker segregation:
 *     MAKER   - employee master, attendance, payroll processing
 *     CHECKER - review, lock and unlock payroll, view audit trail
 *     ADMIN   - settings, statutory slabs, backup/restore, plus everything above
 * - Every successful change is written to audit_log (who, when, what). No salary or
 *   personal identifiers are written to the log.
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from './db/database';

export type UserRole = 'ADMIN' | 'MAKER' | 'CHECKER';

export interface SessionUser {
  username: string;
  display_name: string;
  role: UserRole;
}

const SESSION_COOKIE = 'pc_session';
const SESSION_HOURS = 8;
const sessions = new Map<string, { user: SessionUser; expires: number }>();

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

/**
 * Creates the three default users on first run. Passwords come from the environment
 * (ADMIN_PASSWORD, MAKER_PASSWORD, CHECKER_PASSWORD); the fallbacks are for demo use only.
 */
export function seedUsersIfEmpty(): void {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (count > 0) return;

  const defaults: Array<{ username: string; display_name: string; role: UserRole; password: string }> = [
    { username: 'admin', display_name: 'Finance Head (Admin)', role: 'ADMIN', password: process.env.ADMIN_PASSWORD || 'Admin@2026' },
    { username: 'maker', display_name: 'Payroll Executive (Maker)', role: 'MAKER', password: process.env.MAKER_PASSWORD || 'Maker@2026' },
    { username: 'checker', display_name: 'Finance Manager (Checker)', role: 'CHECKER', password: process.env.CHECKER_PASSWORD || 'Checker@2026' }
  ];

  const insert = db.prepare(
    'INSERT INTO users (username, display_name, role, password_hash, salt, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
  );
  for (const u of defaults) {
    const salt = crypto.randomBytes(16).toString('hex');
    insert.run(u.username, u.display_name, u.role, hashPassword(u.password, salt), salt, new Date().toISOString());
  }
}

export function writeAudit(user: { username: string; role: string } | null, action: string, detail: string = ''): void {
  try {
    getDb()
      .prepare('INSERT INTO audit_log (at, username, role, action, detail) VALUES (?, ?, ?, ?, ?)')
      .run(new Date().toISOString(), user?.username || 'anonymous', user?.role || '-', action, detail.slice(0, 500));
  } catch (err: any) {
    console.error('Audit log write failed:', err.message || err);
  }
}

export function getAuditLog(limit: number = 200) {
  return getDb()
    .prepare('SELECT id, at, username, role, action, detail FROM audit_log ORDER BY id DESC LIMIT ?')
    .all(Math.min(1000, Math.max(1, limit)));
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function getSessionUser(req: Request): SessionUser | null {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.user;
}

export function login(req: Request, res: Response): void {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const row = getDb()
    .prepare('SELECT username, display_name, role, password_hash, salt FROM users WHERE username = ? AND active = 1')
    .get(username) as any;

  const supplied = row ? hashPassword(password, row.salt) : '';
  const valid =
    !!row &&
    supplied.length === row.password_hash.length &&
    crypto.timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(row.password_hash, 'hex'));

  if (!valid) {
    writeAudit({ username: username || 'unknown', role: '-' }, 'LOGIN_FAILED');
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const user: SessionUser = { username: row.username, display_name: row.display_name, role: row.role };
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user, expires: Date.now() + SESSION_HOURS * 3600 * 1000 });

  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}${secure}`
  );
  writeAudit(user, 'LOGIN');
  res.json({ success: true, user });
}

export function logout(req: Request, res: Response): void {
  const token = readCookie(req, SESSION_COOKIE);
  const user = getSessionUser(req);
  if (token) sessions.delete(token);
  if (user) writeAudit(user, 'LOGOUT');
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
  res.json({ success: true });
}

/** Which roles may call a given API route. Reads are open to every signed-in user unless listed. */
function allowedRoles(method: string, path: string): UserRole[] {
  const ALL: UserRole[] = ['ADMIN', 'MAKER', 'CHECKER'];

  if (path.startsWith('/backup')) return ['ADMIN'];
  if (path.startsWith('/audit')) return ['ADMIN', 'CHECKER'];
  if (method === 'GET') return ALL;
  if (path === '/tests/run' || path.startsWith('/ai/')) return ALL;

  if (path === '/payroll/lock' || path === '/payroll/unlock' || path === '/payroll/status') return ['ADMIN', 'CHECKER'];
  if (path === '/payroll/process') return ['ADMIN', 'MAKER'];
  if (path.startsWith('/employees') || path.startsWith('/attendance')) return ['ADMIN', 'MAKER'];

  // Company profile, statutory settings and slabs
  return ['ADMIN'];
}

/** Short, non-sensitive description of a change for the audit trail */
function describeChange(req: Request): string {
  const b = req.body || {};
  const parts: string[] = [];
  const month = b.month || b.payroll_month;
  if (month) parts.push(`month=${month}`);
  if (req.params?.id) parts.push(`id=${req.params.id}`);
  if (b.employee_id) parts.push(`employee=${b.employee_id}`);
  if (b.status) parts.push(`status=${b.status}`);
  if (b.reason) parts.push(`reason=${String(b.reason).slice(0, 200)}`);
  if (Array.isArray(b.rows)) parts.push(`rows=${b.rows.length}`);
  return parts.join('; ');
}

/**
 * Guards every /api route except health and sign-in: requires a session, checks the role,
 * and records successful changes in the audit trail.
 */
export function apiGuard(req: Request, res: Response, next: NextFunction): void {
  const path = req.path;
  if (path === '/health' || path.startsWith('/auth/')) {
    next();
    return;
  }

  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in' });
    return;
  }

  if (!allowedRoles(req.method, path).includes(user.role)) {
    writeAudit(user, 'DENIED', `${req.method} ${path}`);
    res.status(403).json({ error: `Your role (${user.role}) is not permitted to do this` });
    return;
  }

  (req as any).user = user;

  const isChange = req.method !== 'GET' && path !== '/tests/run';
  const isSensitiveRead = req.method === 'GET' && path.startsWith('/backup');
  if (isChange || isSensitiveRead) {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        writeAudit(user, `${req.method} ${req.baseUrl}${req.route?.path || path}`, describeChange(req));
      }
    });
  }

  next();
}
