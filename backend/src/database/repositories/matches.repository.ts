/**
 * Matches Repository
 * 
 * Database operations for 'matches', 'match_meta' and related tables
 */

import { getSqliteDb, getPgPool, usingPostgres } from '../connection.js';
import type { MatchRow, MatchMetaRow } from '../types.js';

export interface MatchInput {
  offerId: string;
  demandId: string;
  similarityScore: number;
  isAiMatch: boolean;
}

export interface MatchMetaInput {
  matchKey: string;
  status?: string;
  note?: string;
  priority?: string;
  lastActionAt?: string;
  resolved?: boolean;
  followUpAt?: string;
  followUpState?: string;
  checklist?: Record<string, any>;
}

export interface FollowUpFilter {
  from?: string;
  to?: string;
  state?: string;
  overdue?: boolean;
}

export interface FollowUpResult {
  match_key: string;
  follow_up_at: string;
  follow_up_state: string;
  status: string;
  priority: string;
  note: string;
  offer_title?: string;
  demand_title?: string;
  profit?: number;
}

/**
 * Save a match to the database
 */
export const saveMatch = async (offerId: string, demandId: string, score: number, isAi: boolean): Promise<void> => {
  const createdAt = new Date().toISOString();

  if (usingPostgres()) {
    const pool = getPgPool();
    try {
      await pool.query(
        `INSERT INTO matches (offer_id, demand_id, similarity_score, is_ai_match, created_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (offer_id, demand_id) DO UPDATE SET
        similarity_score = excluded.similarity_score,
        is_ai_match = excluded.is_ai_match,
        created_at = excluded.created_at`,
        [offerId, demandId, score, isAi, createdAt],
      );
    } catch (error: any) {
      // Ignore foreign key constraint errors - ads might have been deleted
      if (error.code !== '23503') {  // PostgreSQL foreign key violation code
        throw error;
      }
      console.warn(`Match saved but ads not found: ${offerId}, ${demandId}`);
    }
    return;
  }

  const db = await getSqliteDb();
  try {
    // Disable foreign key checks temporarily
    await db.exec('PRAGMA foreign_keys = OFF');
    
    await db.run(
      `INSERT OR IGNORE INTO matches (offer_id, demand_id, similarity_score, is_ai_match, created_at)
        VALUES (?, ?, ?, ?, ?)`,
      [offerId, demandId, score, isAi ? 1 : 0, createdAt],
    );
    
    // Re-enable foreign key checks
    await db.exec('PRAGMA foreign_keys = ON');
  } catch (error: any) {
    // Re-enable foreign key checks on error
    await db.exec('PRAGMA foreign_keys = ON');
    
    // Ignore foreign key constraint errors
    if (!error.message.includes('FOREIGN KEY constraint failed')) {
      throw error;
    }
    console.warn(`Match saved but ads not found: ${offerId}, ${demandId}`);
  }
};

/**
 * Get PostgreSQL vector similarities
 */
export const getPgVectorSimilarities = async (demandAdId: string, threshold = 0.8): Promise<Array<{ offer_id: string; similarity: number }>> => {
  if (!usingPostgres()) return [];

  const pool = getPgPool();
  
  // Nejprve získáme rozměr embeddingu pro demand ad
  const demandDimResult = await pool.query(
    'SELECT embedding_dim FROM ads WHERE id = $1 AND embedding IS NOT NULL',
    [demandAdId]
  );
  
  if (demandDimResult.rows.length === 0) {
    return []; // Demand nemá embedding
  }
  
  const demandDim = demandDimResult.rows[0]?.embedding_dim;
  
  // Pokud nemáme rozměr, zkusíme odvodit z délky embeddingu
  if (!demandDim) {
    const embeddingResult = await pool.query(
      'SELECT embedding FROM ads WHERE id = $1',
      [demandAdId]
    );
    if (embeddingResult.rows.length > 0 && embeddingResult.rows[0]?.embedding) {
      try {
        const embedding = JSON.parse(embeddingResult.rows[0].embedding);
        if (Array.isArray(embedding)) {
          return []; // Nemůžeme porovnávat bez správného vector typu
        }
      } catch {
        return [];
      }
    }
    return [];
  }
  
  const res = await pool.query(
    `SELECT offer.id AS offer_id,
            1 - (offer.embedding::vector <=> demand.embedding::vector) AS similarity
     FROM ads AS demand
     JOIN ads AS offer ON offer.brand = demand.brand
       AND offer.embedding_dim = demand.embedding_dim  -- Stejný rozměr vektorů
     WHERE demand.id = $1
       AND demand.embedding IS NOT NULL
       AND offer.embedding IS NOT NULL
       AND demand.ad_type = 'poptavka'
       AND offer.ad_type = 'nabidka'
       AND offer.url <> demand.url
       AND (1 - (offer.embedding::vector <=> demand.embedding::vector)) >= $2
     ORDER BY similarity DESC
     LIMIT 100`,
    [demandAdId, threshold],
  );

  return res.rows as Array<{ offer_id: string; similarity: number }>;
};

/**
 * Save match metadata
 */
export const saveMatchMeta = async (payload: MatchMetaInput): Promise<void> => {
  const now = new Date().toISOString();
  
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO match_meta (match_key, status, note, priority, last_action_at, resolved, follow_up_at, follow_up_state, checklist_json, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (match_key) DO UPDATE SET
       status = excluded.status, note = excluded.note, priority = excluded.priority, last_action_at = excluded.last_action_at,
       resolved = excluded.resolved, follow_up_at = excluded.follow_up_at, follow_up_state = excluded.follow_up_state, checklist_json = excluded.checklist_json, updated_at = NOW()`,
      [
        payload.matchKey,
        payload.status || 'new',
        payload.note || '',
        payload.priority || 'medium',
        payload.lastActionAt || now,
        payload.resolved ?? false,
        payload.followUpAt || '',
        payload.followUpState || 'none',
        JSON.stringify(payload.checklist || {}),
      ],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO match_meta (match_key, status, note, priority, last_action_at, resolved, follow_up_at, follow_up_state, checklist_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(match_key) DO UPDATE SET
     status=excluded.status, note=excluded.note, priority=excluded.priority, last_action_at=excluded.last_action_at,
     resolved=excluded.resolved, follow_up_at=excluded.follow_up_at, follow_up_state=excluded.follow_up_state, checklist_json=excluded.checklist_json, updated_at=excluded.updated_at`,
    [
      payload.matchKey,
      payload.status || 'new',
      payload.note || '',
      payload.priority || 'medium',
      payload.lastActionAt || now,
      payload.resolved ? 1 : 0,
      payload.followUpAt || '',
      payload.followUpState || 'none',
      JSON.stringify(payload.checklist || {}),
      now,
    ],
  );
};

/**
 * Get all match metadata
 */
export const getAllMatchMeta = async (): Promise<MatchMetaRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM match_meta');
    return res.rows as MatchMetaRow[];
  }
  
  const db = await getSqliteDb();
  return db.all<MatchMetaRow[]>('SELECT * FROM match_meta');
};

/**
 * Get resolved match keys
 */
export const getResolvedMatchKeys = async (): Promise<string[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query('SELECT match_key FROM match_meta WHERE resolved = true');
    return (res.rows as Array<{ match_key: string }>).map(r => r.match_key);
  }
  
  const db = await getSqliteDb();
  const rows = await db.all<{ match_key: string }[]>('SELECT match_key FROM match_meta WHERE resolved = 1');
  return rows.map(r => r.match_key);
};

/**
 * Get previously seen match keys
 */
export const getPreviouslySeenMatchKeys = async (): Promise<string[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT DISTINCT match_key FROM (
        SELECT match_key FROM match_meta
        UNION
        SELECT DISTINCT (offer_id || '__' || demand_id) AS match_key FROM matches
      ) sub
    `);
    return (res.rows as Array<{ match_key: string }>).map(r => r.match_key);
  }
  
  const db = await getSqliteDb();
  const rows = await db.all<{ match_key: string }[]>(`
    SELECT DISTINCT match_key FROM (
      SELECT match_key FROM match_meta
      UNION
      SELECT offer_id || '__' || demand_id AS match_key FROM matches
    )
  `);
  return rows.map(r => r.match_key);
};

/**
 * Mark matches as seen
 */
export const markMatchesAsSeen = async (matchKeys: string[]): Promise<number> => {
  const now = new Date().toISOString();
  let count = 0;

  if (usingPostgres()) {
    const pool = getPgPool();
    for (const key of matchKeys) {
      await pool.query(`
        INSERT INTO match_meta (match_key, status, note, priority, last_action_at, resolved, follow_up_at, follow_up_state, checklist_json, updated_at)
        VALUES ($1, 'new', '', 'medium', $2, false, '', 'none', '{}', $3)
        ON CONFLICT (match_key) DO NOTHING
      `, [key, now, now]);
      count++;
    }
    return count;
  }

  const db = await getSqliteDb();
  for (const key of matchKeys) {
    await db.run(`
      INSERT OR IGNORE INTO match_meta (match_key, status, note, priority, last_action_at, resolved, follow_up_at, follow_up_state, checklist_json, updated_at)
      VALUES (?, 'new', '', 'medium', ?, 0, '', 'none', '{}', ?)
    `, [key, now, now]);
    count++;
  }
  return count;
};

/**
 * Bulk update matches
 */
export const bulkUpdateMatches = async (
  matchKeys: string[],
  updates: { resolved?: boolean; status?: string; priority?: string }
): Promise<number> => {
  const now = new Date().toISOString();

  if (usingPostgres()) {
    const pool = getPgPool();
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (typeof updates.resolved === 'boolean') {
      setClauses.push(`resolved = $${paramIndex++}`);
      values.push(updates.resolved);
    }
    if (typeof updates.status === 'string') {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (typeof updates.priority === 'string') {
      setClauses.push(`priority = $${paramIndex++}`);
      values.push(updates.priority);
    }

    const query = `
      UPDATE match_meta
      SET ${setClauses.join(', ')}
      WHERE match_key = ANY($${paramIndex}::text[])
    `;
    values.push(matchKeys);

    await pool.query(query, values);
    return matchKeys.length;
  }

  const db = await getSqliteDb();
  const setClauses: string[] = ['updated_at = ?'];
  const values: any[] = [now];

  if (typeof updates.resolved === 'boolean') {
    setClauses.push(`resolved = ?`);
    values.push(updates.resolved ? 1 : 0);
  }
  if (typeof updates.status === 'string') {
    setClauses.push(`status = ?`);
    values.push(updates.status);
  }
  if (typeof updates.priority === 'string') {
    setClauses.push(`priority = ?`);
    values.push(updates.priority);
  }

  for (const key of matchKeys) {
    await db.run(`
      UPDATE match_meta
      SET ${setClauses.join(', ')}
      WHERE match_key = ?
    `, [...values, key]);
  }
  return matchKeys.length;
};

/**
 * Get follow-ups with filters
 */
export const getFollowUps = async (options: FollowUpFilter = {}): Promise<FollowUpResult[]> => {
  const today = new Date().toISOString().slice(0, 10);
  const from = options.from || today;
  const to = options.to || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  if (usingPostgres()) {
    const pool = getPgPool();

    let query = `
      SELECT
        mm.match_key,
        mm.follow_up_at,
        mm.follow_up_state,
        mm.status,
        mm.priority,
        mm.note,
        a1.title as offer_title,
        a2.title as demand_title,
        (CAST(a2.price_value AS INTEGER) - CAST(a1.price_value AS INTEGER)) as profit
      FROM match_meta mm
      LEFT JOIN matches m ON m.offer_id || '__' || m.demand_id = mm.match_key
      LEFT JOIN ads a1 ON a1.id = m.offer_id
      LEFT JOIN ads a2 ON a2.id = m.demand_id
      WHERE mm.follow_up_at IS NOT NULL
        AND mm.follow_up_at != ''
        AND mm.resolved = false
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (options.overdue) {
      conditions.push(`mm.follow_up_at < NOW()`);
    } else {
      conditions.push(`mm.follow_up_at >= $${params.length + 1}`);
      params.push(from);
      conditions.push(`mm.follow_up_at <= $${params.length + 1}`);
      params.push(to);
    }

    if (options.state && options.state !== 'none') {
      conditions.push(`mm.follow_up_state = $${params.length + 1}`);
      params.push(options.state);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY mm.follow_up_at ASC';

    const res = await pool.query(query, params);
    return res.rows as FollowUpResult[];
  }

  const db = await getSqliteDb();

  let query = `
    SELECT
      mm.match_key,
      mm.follow_up_at,
      mm.follow_up_state,
      mm.status,
      mm.priority,
      mm.note,
      a1.title as offer_title,
      a2.title as demand_title,
      (CAST(a2.price_value AS INTEGER) - CAST(a1.price_value AS INTEGER)) as profit
    FROM match_meta mm
    LEFT JOIN matches m ON m.offer_id || '__' || m.demand_id = mm.match_key
    LEFT JOIN ads a1 ON a1.id = m.offer_id
    LEFT JOIN ads a2 ON a2.id = m.demand_id
    WHERE mm.follow_up_at IS NOT NULL
      AND mm.follow_up_at != ''
      AND mm.resolved = 0
  `;

  const params: any[] = [];
  const conditions: string[] = [];

  if (options.overdue) {
    conditions.push(`mm.follow_up_at < datetime('now')`);
  } else {
    conditions.push(`mm.follow_up_at >= ?`);
    params.push(from);
    conditions.push(`mm.follow_up_at <= ?`);
    params.push(to);
  }

  if (options.state && options.state !== 'none') {
    conditions.push(`mm.follow_up_state = ?`);
    params.push(options.state);
  }

  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
  }

  query += ' ORDER BY mm.follow_up_at ASC';

  return db.all<FollowUpResult[]>(query, params);
};

/**
 * Get match metadata by key
 */
export const getMatchMetaByKey = async (matchKey: string): Promise<MatchMetaRow | null> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM match_meta WHERE match_key = $1', [matchKey]);
    const row = (res.rows as MatchMetaRow[])[0];
    return row !== undefined ? row : null;
  }
  
  const db = await getSqliteDb();
  const row = await db.get<MatchMetaRow>('SELECT * FROM match_meta WHERE match_key = ?', [matchKey]);
  return row !== undefined ? row : null;
};

/**
 * Get daily stats from match_meta
 */
export const getDailyMetaStats = async (): Promise<{ newCount: number; contactedCount: number; closedCount: number }> => {
  const today = new Date().toISOString().slice(0, 10);

  if (usingPostgres()) {
    const pool = getPgPool();
    const newRes = await pool.query(
      "SELECT COUNT(*) as count FROM match_meta WHERE DATE(last_action_at) = CURRENT_DATE AND status = 'new'",
    );
    const contactedRes = await pool.query(
      "SELECT COUNT(*) as count FROM match_meta WHERE DATE(last_action_at) = CURRENT_DATE AND status = 'contacted'",
    );
    const closedRes = await pool.query(
      "SELECT COUNT(*) as count FROM match_meta WHERE DATE(last_action_at) = CURRENT_DATE AND resolved = true",
    );

    return {
      newCount: parseInt(newRes.rows[0]?.count || '0', 10),
      contactedCount: parseInt(contactedRes.rows[0]?.count || '0', 10),
      closedCount: parseInt(closedRes.rows[0]?.count || '0', 10),
    };
  }

  const db = await getSqliteDb();
  const newRes = await db.get<{ count: number }>(
    "SELECT COUNT(*) as count FROM match_meta WHERE DATE(last_action_at) >= ? AND status = 'new'",
    [today],
  );
  const contactedRes = await db.get<{ count: number }>(
    "SELECT COUNT(*) as count FROM match_meta WHERE DATE(last_action_at) >= ? AND status = 'contacted'",
    [today],
  );
  const closedRes = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM match_meta WHERE DATE(last_action_at) >= ? AND resolved = 1',
    [today],
  );

  return {
    newCount: newRes?.count || 0,
    contactedCount: contactedRes?.count || 0,
    closedCount: closedRes?.count || 0,
  };
};
