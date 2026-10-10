/**
 * SQLite Database Module
 * Handles database initialization and connection
 */

import { readFileSync, mkdirSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const requireFromHere = createRequire(import.meta.url);

// Database file path
const DB_DIR = join(__dirname, '../../data');
const DB_PATH = join(DB_DIR, 'marketing.db');

// Initialize database
let db = null;
let DatabaseDriver = null;

function sqliteDriverMessage(error) {
  const original = error?.message ? `Original error: ${error.message}` : 'Original error: unavailable';
  return [
    'Marketing dashboard SQLite driver error: better-sqlite3 is not available.',
    '',
    'The dashboard server stores asset metadata in SQLite, so it can start only after the native driver is available.',
    '',
    'Remediation:',
    '  cd .claude/skills/ak-marketing-dashboard/server',
    '  npm install',
    '',
    'Windows / newer Node guidance:',
    '  - Prefer Node 20 LTS for the marketing dashboard server.',
    '  - On Windows, install Visual Studio Build Tools with the C++ desktop workload if npm must build native addons.',
    '  - If dependencies are already installed, run: npm rebuild better-sqlite3 --build-from-source',
    '',
    original
  ].join('\n');
}

export class SQLiteDriverUnavailableError extends Error {
  constructor(error) {
    super(sqliteDriverMessage(error));
    this.name = 'SQLiteDriverUnavailableError';
    this.code = 'SQLITE_DRIVER_UNAVAILABLE';
    this.cause = error;
  }
}

export function loadSQLiteDriver(requireFn = requireFromHere) {
  const shouldUseCache = requireFn === requireFromHere;
  if (shouldUseCache && DatabaseDriver) {
    return DatabaseDriver;
  }

  try {
    const loaded = requireFn('better-sqlite3');
    const driver = loaded?.default ?? loaded;
    if (shouldUseCache) {
      DatabaseDriver = driver;
    }
    return driver;
  } catch (error) {
    throw new SQLiteDriverUnavailableError(error);
  }
}

export function initDatabase(options = {}) {
  try {
    const Database = loadSQLiteDriver(options.requireFn);
    const dbPath = options.dbPath || DB_PATH;
    const schemaPath = options.schemaPath || join(__dirname, 'schema.sql');
    const dbDir = options.dbDir || dirname(dbPath);

    // Create data directory if it doesn't exist
    if (dbPath !== ':memory:' && !existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    // Create database connection
    db = new Database(dbPath);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Read and execute schema
    const schema = readFileSync(schemaPath, 'utf-8');
    db.exec(schema);

    console.log('✓ Database initialized:', dbPath);
    return db;
  } catch (error) {
    if (error instanceof SQLiteDriverUnavailableError) {
      console.error(error.message);
    } else {
      console.error('Database initialization failed:', error);
    }
    throw error;
  }
}

export function getDatabase() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// Export default instance
export default { initDatabase, getDatabase, closeDatabase };
