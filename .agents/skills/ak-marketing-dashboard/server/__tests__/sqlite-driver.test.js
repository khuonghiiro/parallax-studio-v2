import { describe, expect, it } from 'vitest';
import {
  initDatabase,
  loadSQLiteDriver,
  SQLiteDriverUnavailableError
} from '../db/database.js';

function missingDriverRequire() {
  const error = new Error("Cannot find module 'better-sqlite3'");
  error.code = 'MODULE_NOT_FOUND';
  throw error;
}

function nativeBuildFailureRequire() {
  const error = new Error('No native build was found for better-sqlite3');
  error.code = 'ERR_DLOPEN_FAILED';
  throw error;
}

function captureThrown(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected function to throw');
}

describe('SQLite driver boundary', () => {
  it('wraps a missing better-sqlite3 driver with dashboard setup guidance', () => {
    const error = captureThrown(() => {
      initDatabase({ dbPath: ':memory:', requireFn: missingDriverRequire });
    });

    expect(error).toBeInstanceOf(SQLiteDriverUnavailableError);
    expect(error.code).toBe('SQLITE_DRIVER_UNAVAILABLE');
    expect(error.message).toContain('better-sqlite3 is not available');
    expect(error.message).toContain('cd .claude/skills/ak-marketing-dashboard/server');
    expect(error.message).toContain('npm install');
    expect(error.message).toContain('Windows');
    expect(error.message).toContain('Node 20');
  });

  it('treats native driver load failures as the same setup boundary', () => {
    const error = captureThrown(() => {
      loadSQLiteDriver(nativeBuildFailureRequire);
    });

    expect(error).toBeInstanceOf(SQLiteDriverUnavailableError);
    expect(error.message).toContain('better-sqlite3 is not available');
    expect(error.cause.code).toBe('ERR_DLOPEN_FAILED');
  });
});
