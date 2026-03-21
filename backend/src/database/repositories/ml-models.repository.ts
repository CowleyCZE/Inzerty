/**
 * ML Models Repository
 * 
 * Database operations for ml_models table
 */

import { getSqliteDb, getPgPool, usingPostgres } from '../connection.js';
import type { MLModelRow } from '../types.js';

export interface MLModelInput {
  modelName: string;
  modelType: 'priority_scorer' | 'fraud_detector' | 'match_recommender' | 'price_predictor';
  version: string;
  modelData?: any;
  accuracy?: number;
  isActive?: boolean;
}

/**
 * Save ML model
 */
export const saveMLModel = async (input: MLModelInput): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO ml_models (model_name, model_type, version, model_data, trained_at, accuracy, is_active)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6)
       ON CONFLICT (model_name, version) DO UPDATE SET
       model_data = EXCLUDED.model_data,
       trained_at = NOW(),
       accuracy = EXCLUDED.accuracy,
       is_active = EXCLUDED.is_active`,
      [
        input.modelName,
        input.modelType,
        input.version,
        input.modelData ? JSON.stringify(input.modelData) : null,
        input.accuracy || null,
        input.isActive ? 1 : 0,
      ],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO ml_models (model_name, model_type, version, model_data, trained_at, accuracy, is_active)
     VALUES (?, ?, ?, ?, datetime('now'), ?, ?)
     ON CONFLICT(model_name, version) DO UPDATE SET
     model_data = excluded.model_data,
     trained_at = datetime('now'),
     accuracy = excluded.accuracy,
     is_active = excluded.is_active`,
    [
      input.modelName,
      input.modelType,
      input.version,
      input.modelData ? JSON.stringify(input.modelData) : null,
      input.accuracy || null,
      input.isActive ? 1 : 0,
    ],
  );
};

/**
 * Get ML model by name and version
 */
export const getMLModel = async (
  modelName: string,
  version?: string
): Promise<MLModelRow | null> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    if (version) {
      const res = await pool.query(
        `SELECT * FROM ml_models WHERE model_name = $1 AND version = $2`,
        [modelName, version],
      );
      const row = (res.rows as MLModelRow[])[0];
      return row !== undefined ? row : null;
    }
    
    // Get latest active version
    const res = await pool.query(
      `SELECT * FROM ml_models WHERE model_name = $1 AND is_active = TRUE ORDER BY trained_at DESC LIMIT 1`,
      [modelName],
    );
    const row = (res.rows as MLModelRow[])[0];
    return row !== undefined ? row : null;
  }

  const db = await getSqliteDb();
  if (version) {
    const row = await db.get<MLModelRow>(
      `SELECT * FROM ml_models WHERE model_name = ? AND version = ?`,
      [modelName, version],
    );
    return row !== undefined ? row : null;
  }
  
  // Get latest active version
  const row = await db.get<MLModelRow>(
    `SELECT * FROM ml_models WHERE model_name = ? AND is_active = 1 ORDER BY trained_at DESC LIMIT 1`,
    [modelName],
  );
  return row !== undefined ? row : null;
};

/**
 * Get all ML models
 */
export const getAllMLModels = async (): Promise<MLModelRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM ml_models ORDER BY model_name, version DESC`,
    );
    return res.rows as MLModelRow[];
  }

  const db = await getSqliteDb();
  return db.all<MLModelRow[]>(
    `SELECT * FROM ml_models ORDER BY model_name, version DESC`,
  );
};

/**
 * Get active ML models
 */
export const getActiveMLModels = async (): Promise<MLModelRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM ml_models WHERE is_active = TRUE ORDER BY model_name`,
    );
    return res.rows as MLModelRow[];
  }

  const db = await getSqliteDb();
  return db.all<MLModelRow[]>(
    `SELECT * FROM ml_models WHERE is_active = 1 ORDER BY model_name`,
  );
};

/**
 * Set model as active/inactive
 */
export const setModelActive = async (
  modelName: string,
  version: string,
  isActive: boolean
): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `UPDATE ml_models SET is_active = $1 WHERE model_name = $2 AND version = $3`,
      [isActive ? 1 : 0, modelName, version],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `UPDATE ml_models SET is_active = ? WHERE model_name = ? AND version = ?`,
    [isActive ? 1 : 0, modelName, version],
  );
};

/**
 * Delete ML model
 */
export const deleteMLModel = async (
  modelName: string,
  version: string
): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `DELETE FROM ml_models WHERE model_name = $1 AND version = $2`,
      [modelName, version],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `DELETE FROM ml_models WHERE model_name = ? AND version = ?`,
    [modelName, version],
  );
};

/**
 * Get models by type
 */
export const getModelsByType = async (
  modelType: string
): Promise<MLModelRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM ml_models WHERE model_type = $1 ORDER BY trained_at DESC`,
      [modelType],
    );
    return res.rows as MLModelRow[];
  }

  const db = await getSqliteDb();
  return db.all<MLModelRow[]>(
    `SELECT * FROM ml_models WHERE model_type = ? ORDER BY trained_at DESC`,
    [modelType],
  );
};
