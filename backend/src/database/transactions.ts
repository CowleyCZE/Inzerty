/**
 * Transaction Management
 * 
 * Provides transaction wrapper for both SQLite and PostgreSQL
 */

import { getSqliteDb, getPgPool, usingPostgres } from './connection.js';

/**
 * Transaction callback function type
 */
export type TransactionCallback<T> = (db: any) => Promise<T>;

/**
 * Run a database transaction
 * 
 * For PostgreSQL: Uses BEGIN/COMMIT/ROLLBACK with connection pool
 * For SQLite: Uses BEGIN TRANSACTION/COMMIT/ROLLBACK
 * 
 * @param callback - Async function to execute within transaction
 * @returns Result of the callback function
 * @throws Error if transaction fails (automatically rolled back)
 */
export const runTransaction = async <T>(callback: TransactionCallback<T>): Promise<T> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = await getSqliteDb();
    
    await db.exec('PRAGMA foreign_keys = OFF;');
    await db.exec('BEGIN TRANSACTION;');
    
    try {
      const result = await callback(db);
      await db.exec('COMMIT;');
      return result;
    } catch (error) {
      await db.exec('ROLLBACK;');
      throw error;
    } finally {
      await db.exec('PRAGMA foreign_keys = ON;');
    }
  }
};

/**
 * Run a transaction with retry logic
 * 
 * Useful for handling SQLite busy errors or PostgreSQL serialization failures
 * 
 * @param callback - Async function to execute within transaction
 * @param retries - Number of retry attempts (default: 3)
 * @param delayMs - Delay between retries in milliseconds (default: 100)
 * @returns Result of the callback function
 * @throws Error if all retries fail
 */
export const runTransactionWithRetry = async <T>(
  callback: TransactionCallback<T>,
  retries: number = 3,
  delayMs: number = 100
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await runTransaction(callback);
    } catch (error: any) {
      lastError = error;
      
      // SQLite busy error or PostgreSQL serialization failure
      const isRetryableError = 
        error.code === 'SQLITE_BUSY' ||
        error.code === '40001' || // PostgreSQL serialization failure
        error.message.includes('database is locked') ||
        error.message.includes('deadlock detected');
      
      if (!isRetryableError || attempt === retries) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  
  throw lastError;
};

/**
 * Execute multiple operations in a batch within a transaction
 */
export const runBatch = async <T>(operations: Array<(db: any) => Promise<T>>): Promise<T[]> => {
  return runTransaction(async (db) => {
    const results: T[] = [];
    for (const operation of operations) {
      const result = await operation(db);
      results.push(result);
    }
    return results;
  });
};
