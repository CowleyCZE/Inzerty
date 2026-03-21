/**
 * Meeting Feedback Repository
 * 
 * Database operations for meeting_feedback table
 */

import { getSqliteDb, getPgPool, usingPostgres } from '../connection.js';
import type { MeetingFeedbackRow } from '../types.js';

export interface MeetingFeedbackInput {
  matchKey: string;
  rating: number;  // 1-5
  feedbackText?: string;
  wouldMeetAgain: boolean;
}

/**
 * Save meeting feedback
 */
export const saveMeetingFeedback = async (input: MeetingFeedbackInput): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO meeting_feedback (match_key, rating, feedback_text, would_meet_again, submitted_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [input.matchKey, input.rating, input.feedbackText || null, input.wouldMeetAgain ? 1 : 0],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO meeting_feedback (match_key, rating, feedback_text, would_meet_again, submitted_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [input.matchKey, input.rating, input.feedbackText || null, input.wouldMeetAgain ? 1 : 0],
  );
};

/**
 * Get meeting feedback for a match
 */
export const getMeetingFeedback = async (matchKey: string): Promise<MeetingFeedbackRow | null> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM meeting_feedback WHERE match_key = $1`,
      [matchKey],
    );
    const row = (res.rows as MeetingFeedbackRow[])[0];
    return row !== undefined ? row : null;
  }

  const db = await getSqliteDb();
  const row = await db.get<MeetingFeedbackRow>(
    `SELECT * FROM meeting_feedback WHERE match_key = ?`,
    [matchKey],
  );
  return row !== undefined ? row : null;
};

/**
 * Get meeting feedback statistics
 */
export const getFeedbackStats = async (): Promise<{
  totalFeedbacks: number;
  avgRating: number;
  wouldMeetAgainPercent: number;
  ratingDistribution: Record<number, number>;
}> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT
        COUNT(*) as total_feedbacks,
        AVG(rating) as avg_rating,
        COUNT(*) FILTER (WHERE would_meet_again = true) * 100.0 / COUNT(*) as would_meet_again_percent,
        COUNT(*) FILTER (WHERE rating = 1) as rating_1,
        COUNT(*) FILTER (WHERE rating = 2) as rating_2,
        COUNT(*) FILTER (WHERE rating = 3) as rating_3,
        COUNT(*) FILTER (WHERE rating = 4) as rating_4,
        COUNT(*) FILTER (WHERE rating = 5) as rating_5
      FROM meeting_feedback
    `);
    const row = res.rows[0] as any;
    return {
      totalFeedbacks: parseInt(row.total_feedbacks || '0', 10),
      avgRating: parseFloat(row.avg_rating || '0'),
      wouldMeetAgainPercent: parseFloat(row.would_meet_again_percent || '0'),
      ratingDistribution: {
        1: parseInt(row.rating_1 || '0', 10),
        2: parseInt(row.rating_2 || '0', 10),
        3: parseInt(row.rating_3 || '0', 10),
        4: parseInt(row.rating_4 || '0', 10),
        5: parseInt(row.rating_5 || '0', 10),
      },
    };
  }

  const db = await getSqliteDb();
  const row = await db.get<any>(`
    SELECT
      COUNT(*) as total_feedbacks,
      AVG(rating) as avg_rating,
      SUM(CASE WHEN would_meet_again = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as would_meet_again_percent,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as rating_1,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as rating_2,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as rating_3,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as rating_4,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as rating_5
    FROM meeting_feedback
  `);
  return {
    totalFeedbacks: row?.total_feedbacks || 0,
    avgRating: parseFloat(row?.avg_rating || '0'),
    wouldMeetAgainPercent: parseFloat(row?.would_meet_again_percent || '0'),
    ratingDistribution: {
      1: row?.rating_1 || 0,
      2: row?.rating_2 || 0,
      3: row?.rating_3 || 0,
      4: row?.rating_4 || 0,
      5: row?.rating_5 || 0,
    },
  };
};

/**
 * Get feedback by rating
 */
export const getFeedbackByRating = async (rating: number): Promise<MeetingFeedbackRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM meeting_feedback WHERE rating = $1 ORDER BY submitted_at DESC`,
      [rating],
    );
    return res.rows as MeetingFeedbackRow[];
  }

  const db = await getSqliteDb();
  return db.all<MeetingFeedbackRow[]>(
    `SELECT * FROM meeting_feedback WHERE rating = ? ORDER BY submitted_at DESC`,
    [rating],
  );
};

/**
 * Get recent feedback
 */
export const getRecentFeedback = async (limit = 10): Promise<MeetingFeedbackRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM meeting_feedback ORDER BY submitted_at DESC LIMIT $1`,
      [limit],
    );
    return res.rows as MeetingFeedbackRow[];
  }

  const db = await getSqliteDb();
  return db.all<MeetingFeedbackRow[]>(
    `SELECT * FROM meeting_feedback ORDER BY submitted_at DESC LIMIT ?`,
    [limit],
  );
};
