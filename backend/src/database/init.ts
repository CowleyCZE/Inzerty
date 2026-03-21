/**
 * Database Initialization
 * 
 * Creates database tables and runs initial setup
 */

import { getSqliteDb, getPgPool, usingPostgres } from './connection.js';
import { POSTGRES_SCHEMA, SQLITE_SCHEMA } from './schema.js';

let isInitialized = false;
let pgVectorReady = false;

/**
 * Initialize database tables
 */
export const initDb = async (): Promise<void> => {
  if (isInitialized) return;

  if (usingPostgres()) {
    const pool = getPgPool();
    
    // Execute PostgreSQL schema
    await pool.query(POSTGRES_SCHEMA);
    
    // Check if pgvector is available
    try {
      await pool.query('SELECT * FROM pg_extension WHERE extname = \'vector\'');
      pgVectorReady = true;
    } catch {
      pgVectorReady = false;
    }
  } else {
    const db = await getSqliteDb();
    
    // Simple approach: execute each line that contains CREATE TABLE or CREATE INDEX
    const lines = SQLITE_SCHEMA.split('\n');
    let currentStatement = '';
    
    for (const line of lines) {
      currentStatement += line + '\n';
      
      // If line ends with semicolon, execute the statement
      if (line.trim().endsWith(';')) {
        try {
          await db.exec(currentStatement);
        } catch (error: any) {
          // Ignore "already exists" errors
          if (!error.message.includes('already exists')) {
            console.error('Error executing statement:', error.message.substring(0, 100));
          }
        }
        currentStatement = '';
      }
    }
  }

  isInitialized = true;
};

/**
 * Check if pgvector is available (PostgreSQL only)
 */
export const isPgVectorAvailable = (): boolean => {
  return usingPostgres() && pgVectorReady;
};

/**
 * Clear all data from database
 */
export const clearDatabase = async (): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query('TRUNCATE TABLE matches, match_meta, scrape_checkpoints, conversations, ads RESTART IDENTITY CASCADE');
    return;
  }

  const db = await getSqliteDb();
  
  // Disable foreign keys temporarily
  await db.exec('PRAGMA foreign_keys = OFF');
  
  // Delete all data
  await db.exec('DELETE FROM matches');
  await db.exec('DELETE FROM match_meta');
  await db.exec('DELETE FROM scrape_checkpoints');
  await db.exec('DELETE FROM conversations');
  await db.exec('DELETE FROM deal_states');
  await db.exec('DELETE FROM followup_schedule');
  await db.exec('DELETE FROM fraud_flags');
  await db.exec('DELETE FROM seller_watchlist');
  await db.exec('DELETE FROM negotiation_history');
  await db.exec('DELETE FROM deal_analytics');
  await db.exec('DELETE FROM fraud_analysis_history');
  await db.exec('DELETE FROM email_settings');
  await db.exec('DELETE FROM email_templates');
  await db.exec('DELETE FROM message_templates');
  await db.exec('DELETE FROM ads');
  
  // Re-enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON');
  
  // Vacuum to reclaim space
  await db.exec('VACUUM');
};
