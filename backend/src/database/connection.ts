/**
 * Database Connection Management
 * 
 * Handles connections to SQLite and PostgreSQL databases
 */

import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type DbClient = 'sqlite' | 'postgres';
const DB_CLIENT: DbClient = process.env.DB_CLIENT === 'postgres' ? 'postgres' : 'sqlite';

let sqliteDb: Database | null = null;
let postgresPool: any = null;

/**
 * Get SQLite database connection
 */
export const getSqliteDb = async (): Promise<Database> => {
  if (sqliteDb) return sqliteDb;

  sqliteDb = await open({
    filename: path.join(__dirname, '..', 'inzerty.db'),
    driver: sqlite3.Database,
  });

  await sqliteDb.exec('PRAGMA foreign_keys = ON;');
  return sqliteDb;
};

/**
 * Get PostgreSQL connection pool
 */
export const getPgPool = (): any => {
  if (postgresPool) return postgresPool;

  let Pool: any;
  try {
    ({ Pool } = require('pg'));
  } catch (error) {
    throw new Error('PostgreSQL mode requires the "pg" package to be installed.');
  }

  postgresPool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/inzerty',
  });
  return postgresPool;
};

/**
 * Check if using PostgreSQL
 */
export const usingPostgres = (): boolean => DB_CLIENT === 'postgres';

/**
 * Check if using SQLite
 */
export const usingSqlite = (): boolean => DB_CLIENT === 'sqlite';

/**
 * Get current database client type
 */
export const getDbClient = (): DbClient => DB_CLIENT;

/**
 * Close all database connections
 */
export const closeDbConnections = async (): Promise<void> => {
  if (sqliteDb) {
    await sqliteDb.close();
    sqliteDb = null;
  }
  if (postgresPool) {
    await postgresPool.end();
    postgresPool = null;
  }
};
