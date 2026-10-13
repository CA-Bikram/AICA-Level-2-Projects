/**
 * OneHR Payroll Manager - Native SQLite Database Manager (better-sqlite3)
 * 
 * Features:
 * - High performance synchronous C++ SQLite engine
 * - WAL (Write-Ahead Logging) mode for high-concurrency LAN reads & writes
 * - Configured PRAGMAs: journal_mode=WAL, synchronous=NORMAL, foreign_keys=ON, busy_timeout=5000
 * - WAL-safe live database backups using SQLite Online Backup API (db.backup())
 * - Atomic transaction runner
 * - Comprehensive database health check
 */

import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// DATA_DIR lets a host point the database at a persistent disk; default is ./data
const DB_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'payroll_compli.sqlite');

let dbInstance: DatabaseType | null = null;

export interface DatabaseHealth {
  engine: string;
  version: string;
  journalMode: string;
  synchronous: number;
  foreignKeys: boolean;
  busyTimeout: number;
  dbFile: string;
  fileSizeBytes: number;
  walFileSizeBytes: number;
  status: 'healthy' | 'degraded' | 'error';
  tables: Record<string, number>;
  timestamp: string;
}

/**
 * Initializes and returns the singleton better-sqlite3 database connection
 */
export function getDb(): DatabaseType {
  if (dbInstance && dbInstance.open) {
    return dbInstance;
  }

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  try {
    dbInstance = new Database(DB_FILE, {
      timeout: 5000,
      verbose: process.env.SQLITE_VERBOSE === 'true' ? console.log : undefined
    });

    // Configure mandatory PRAGMAs for LAN concurrency & integrity
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('synchronous = NORMAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('busy_timeout = 5000');

    return dbInstance;
  } catch (err: any) {
    console.error('Fatal: Failed to open native SQLite database at', DB_FILE, err);
    throw new Error(`Database connection failed: ${err.message}`);
  }
}

/**
 * Explicit database close function
 */
export function closeDb(): void {
  if (dbInstance && dbInstance.open) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Executes a callback within an atomic transaction.
 * Automatically commits if successful, rolls back cleanly if any error is thrown.
 */
export function runInTransaction<T>(fn: (db: DatabaseType) => T): T {
  const db = getDb();
  const tx = db.transaction(fn);
  return tx(db);
}

/**
 * Safe, WAL-compatible live backup using SQLite Online Backup API.
 * Ensures consistent snapshots without corruption even while reads/writes occur.
 */
export async function backupDatabase(destPath?: string): Promise<{ success: boolean; backupFile: string; fileSizeBytes: number }> {
  const db = getDb();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFolder = path.resolve(process.cwd(), 'backups', 'sqlite');

  if (!fs.existsSync(backupFolder)) {
    fs.mkdirSync(backupFolder, { recursive: true });
  }

  const targetFile = destPath || path.join(backupFolder, `payroll_compli_${timestamp}.sqlite`);

  await db.backup(targetFile);
  const stat = fs.statSync(targetFile);

  return {
    success: true,
    backupFile: targetFile,
    fileSizeBytes: stat.size
  };
}

/**
 * Database health check reporting engine, PRAGMAs, and table metrics
 */
export function getDbHealth(): DatabaseHealth {
  const db = getDb();
  const versionRow = db.prepare('SELECT sqlite_version() as v').get() as { v: string };
  const journalMode = db.pragma('journal_mode', { simple: true }) as string;
  const synchronous = db.pragma('synchronous', { simple: true }) as number;
  const foreignKeys = (db.pragma('foreign_keys', { simple: true }) as number) === 1;
  const busyTimeout = db.pragma('busy_timeout', { simple: true }) as number;

  const dbStat = fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE) : { size: 0 };
  const walFile = `${DB_FILE}-wal`;
  const walStat = fs.existsSync(walFile) ? fs.statSync(walFile) : { size: 0 };

  const tablesToCheck = ['companies', 'settings', 'pt_slabs', 'tax_slabs', 'employees', 'attendance', 'payroll_runs', 'payroll', 'users', 'audit_log', 'schema_migrations'];
  const tableCounts: Record<string, number> = {};

  for (const t of tablesToCheck) {
    try {
      const res = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as { c: number };
      tableCounts[t] = res.c;
    } catch {
      tableCounts[t] = 0;
    }
  }

  return {
    engine: 'better-sqlite3 (Native SQLite)',
    version: versionRow.v,
    journalMode,
    synchronous,
    foreignKeys,
    busyTimeout,
    dbFile: DB_FILE,
    fileSizeBytes: dbStat.size,
    walFileSizeBytes: walStat.size,
    status: 'healthy',
    tables: tableCounts,
    timestamp: new Date().toISOString()
  };
}
