/**
 * Deal States Repository
 * 
 * Database operations for deal_states table and related followup functionality
 */

import { getSqliteDb, getPgPool, usingPostgres } from '../connection.js';
import type { DealStateRow, FollowupScheduleRow } from '../types.js';

export type DealState = 'new' | 'contacted' | 'negotiating' | 'agreed' | 'meeting_scheduled' | 'completed' | 'cancelled' | 'stalled';

export interface DealStateInput {
  matchKey: string;
  state: DealState;
  previousState?: DealState;
  metadata?: any;
}

export interface FollowupInput {
  matchKey: string;
  scheduledAt: string;
  templateType?: 'gentle_reminder' | 'urgent_followup' | 'final_check';
  channel?: 'email' | 'sms' | 'bazos';
  isAiGenerated?: boolean;
}

export interface DealPipelineStats {
  state: DealState;
  count: number;
  avgDaysInState: number;
}

/**
 * Initialize deal state for a new match
 */
export const initDealState = async (matchKey: string): Promise<void> => {
  const now = new Date().toISOString();

  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO deal_states (match_key, state, state_changed_at)
       VALUES ($1, 'new', $2)
       ON CONFLICT (match_key) DO NOTHING`,
      [matchKey, now],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT OR IGNORE INTO deal_states (match_key, state, state_changed_at)
     VALUES (?, 'new', ?)`,
    [matchKey, now],
  );
};

/**
 * Update deal state
 */
export const updateDealState = async (
  matchKey: string,
  newState: DealState,
  metadata?: any
): Promise<void> => {
  const now = new Date().toISOString();

  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `UPDATE deal_states SET
       state = $1,
       previous_state = state,
       state_changed_at = $2,
       last_contact_at = CASE WHEN $1 IN ('contacted', 'negotiating', 'agreed') THEN $2 ELSE last_contact_at END,
       followup_count = followup_count + 1
       WHERE match_key = $3`,
      [newState, now, matchKey],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `UPDATE deal_states SET
     state = ?,
     previous_state = state,
     state_changed_at = ?,
     last_contact_at = CASE WHEN ? IN ('contacted', 'negotiating', 'agreed') THEN ? ELSE last_contact_at END,
     followup_count = followup_count + 1
     WHERE match_key = ?`,
    [newState, now, newState, now, matchKey],
  );
};

/**
 * Get deal state for a match
 */
export const getDealState = async (matchKey: string): Promise<DealStateRow | null> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM deal_states WHERE match_key = $1', [matchKey]);
    const row = (res.rows as DealStateRow[])[0];
    return row !== undefined ? row : null;
  }

  const db = await getSqliteDb();
  const row = await db.get<DealStateRow>('SELECT * FROM deal_states WHERE match_key = ?', [matchKey]);
  return row !== undefined ? row : null;
};

/**
 * Get all deal states with optional filters
 */
export const getAllDealStates = async (filters?: {
  state?: DealState;
  limit?: number;
}): Promise<DealStateRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    let query = 'SELECT * FROM deal_states';
    const params: any[] = [];
    
    if (filters?.state) {
      query += ' WHERE state = $1';
      params.push(filters.state);
    }
    
    query += ' ORDER BY last_contact_at DESC';
    
    if (filters?.limit) {
      query += ' LIMIT $' + (params.length + 1);
      params.push(filters.limit);
    }
    
    const res = await pool.query(query, params);
    return res.rows as DealStateRow[];
  }

  const db = await getSqliteDb();
  let query = 'SELECT * FROM deal_states';
  const params: any[] = [];
  
  if (filters?.state) {
    query += ' WHERE state = ?';
    params.push(filters.state);
  }
  
  query += ' ORDER BY last_contact_at DESC';
  
  if (filters?.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }
  
  return db.all<DealStateRow[]>(query, params);
};

/**
 * Mark deal as contacted
 */
export const markDealContacted = async (matchKey: string): Promise<void> => {
  await updateDealState(matchKey, 'contacted');
};

/**
 * Mark deal as stalled
 */
export const markDealStalled = async (matchKey: string): Promise<void> => {
  await updateDealState(matchKey, 'stalled');
};

/**
 * Increment followup count for a deal
 */
export const incrementFollowupCount = async (matchKey: string): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `UPDATE deal_states SET followup_count = followup_count + 1 WHERE match_key = $1`,
      [matchKey],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `UPDATE deal_states SET followup_count = followup_count + 1 WHERE match_key = ?`,
    [matchKey],
  );
};

/**
 * Schedule a followup for a deal
 */
export const scheduleFollowup = async (input: FollowupInput): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO followup_schedule (match_key, scheduled_at, template_type, channel, is_ai_generated, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [input.matchKey, input.scheduledAt, input.templateType || null, input.channel || 'email', input.isAiGenerated ? 1 : 0],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO followup_schedule (match_key, scheduled_at, template_type, channel, is_ai_generated, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [input.matchKey, input.scheduledAt, input.templateType || null, input.channel || 'email', input.isAiGenerated ? 1 : 0],
  );
};

/**
 * Get pending followups
 */
export const getPendingFollowups = async (): Promise<FollowupScheduleRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM followup_schedule
       WHERE status = 'pending' AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC`,
    );
    return res.rows as FollowupScheduleRow[];
  }

  const db = await getSqliteDb();
  return db.all<FollowupScheduleRow[]>(
    `SELECT * FROM followup_schedule
     WHERE status = 'pending' AND scheduled_at <= datetime('now')
     ORDER BY scheduled_at ASC`,
  );
};

/**
 * Mark followup as sent
 */
export const markFollowupSent = async (followupId: number): Promise<void> => {
  const now = new Date().toISOString();

  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `UPDATE followup_schedule SET status = 'sent', sent_at = $1 WHERE id = $2`,
      [now, followupId],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `UPDATE followup_schedule SET status = 'sent', sent_at = ? WHERE id = ?`,
    [now, followupId],
  );
};

/**
 * Get deal pipeline statistics
 */
export const getDealPipeline = async (): Promise<DealPipelineStats[]> => {
  const states: DealState[] = ['new', 'contacted', 'negotiating', 'agreed', 'meeting_scheduled', 'completed', 'cancelled', 'stalled'];

  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT
        state,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (NOW() - state_changed_at)) / 86400) as avg_days_in_state
      FROM deal_states
      GROUP BY state
      ORDER BY
        CASE state
          WHEN 'new' THEN 1
          WHEN 'contacted' THEN 2
          WHEN 'negotiating' THEN 3
          WHEN 'agreed' THEN 4
          WHEN 'meeting_scheduled' THEN 5
          WHEN 'completed' THEN 6
          WHEN 'cancelled' THEN 7
          WHEN 'stalled' THEN 8
        END
    `);
    
    return states.map(state => {
      const row = res.rows.find((r: any) => r.state === state);
      return {
        state,
        count: parseInt(row?.count || '0', 10),
        avgDaysInState: parseFloat(row?.avg_days_in_state || '0'),
      };
    });
  }

  const db = await getSqliteDb();
  const res = await db.all<any>(`
    SELECT
      state,
      COUNT(*) as count,
      AVG(JULIANDAY('now') - JULIANDAY(state_changed_at)) as avg_days_in_state
    FROM deal_states
    GROUP BY state
  `);
  
  return states.map(state => {
    const row = res.find((r: any) => r.state === state);
    return {
      state,
      count: row?.count || 0,
      avgDaysInState: parseFloat(row?.avg_days_in_state || '0'),
    };
  });
};

/**
 * Get stalled deals (no contact in 48+ hours)
 */
export const getStalledDeals = async (hours = 48): Promise<DealStateRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM deal_states
       WHERE state NOT IN ('completed', 'cancelled')
       AND (last_contact_at IS NULL OR last_contact_at < NOW() - INTERVAL '${hours} hours')
       ORDER BY last_contact_at ASC NULLS FIRST`,
    );
    return res.rows as DealStateRow[];
  }

  const db = await getSqliteDb();
  return db.all<DealStateRow[]>(
    `SELECT * FROM deal_states
     WHERE state NOT IN ('completed', 'cancelled')
     AND (last_contact_at IS NULL OR last_contact_at < datetime('now', '-' || ? || ' hours'))
     ORDER BY last_contact_at ASC`,
    [hours],
  );
};
