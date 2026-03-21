/**
 * Calendar Repository
 * 
 * Database operations for calendar_events table
 */

import { getSqliteDb, getPgPool, usingPostgres } from '../connection.js';
import type { CalendarEventRow } from '../types.js';

export interface CalendarEventInput {
  matchKey: string;
  eventType: 'meeting' | 'followup' | 'deadline' | 'reminder';
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt?: string;
  reminderMinutes?: number;
  status?: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  icalData?: string;
}

/**
 * Save a calendar event
 */
export const saveCalendarEvent = async (input: CalendarEventInput): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO calendar_events 
       (match_key, event_type, title, description, location, start_at, end_at, reminder_minutes, status, ical_data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       ON CONFLICT (match_key, event_type, start_at) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       location = EXCLUDED.location,
       end_at = EXCLUDED.end_at,
       reminder_minutes = EXCLUDED.reminder_minutes,
       status = EXCLUDED.status,
       ical_data = EXCLUDED.ical_data,
       updated_at = NOW()`,
      [
        input.matchKey,
        input.eventType,
        input.title,
        input.description || null,
        input.location || null,
        input.startAt,
        input.endAt || null,
        input.reminderMinutes || 30,
        input.status || 'scheduled',
        input.icalData || null,
      ],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO calendar_events 
     (match_key, event_type, title, description, location, start_at, end_at, reminder_minutes, status, ical_data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(match_key, event_type, start_at) DO UPDATE SET
     title = excluded.title,
     description = excluded.description,
     location = excluded.location,
     end_at = excluded.end_at,
     reminder_minutes = excluded.reminder_minutes,
     status = excluded.status,
     ical_data = excluded.ical_data,
     updated_at = excluded.updated_at`,
    [
      input.matchKey,
      input.eventType,
      input.title,
      input.description || null,
      input.location || null,
      input.startAt,
      input.endAt || null,
      input.reminderMinutes || 30,
      input.status || 'scheduled',
      input.icalData || null,
    ],
  );
};

/**
 * Get calendar event by match key
 */
export const getCalendarEvent = async (matchKey: string): Promise<CalendarEventRow | null> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM calendar_events WHERE match_key = $1 ORDER BY start_at DESC LIMIT 1`,
      [matchKey],
    );
    const row = (res.rows as CalendarEventRow[])[0];
    return row !== undefined ? row : null;
  }

  const db = await getSqliteDb();
  const row = await db.get<CalendarEventRow>(
    `SELECT * FROM calendar_events WHERE match_key = ? ORDER BY start_at DESC LIMIT 1`,
    [matchKey],
  );
  return row !== undefined ? row : null;
};

/**
 * Get upcoming calendar events
 */
export const getUpcomingCalendarEvents = async (
  from?: string,
  to?: string,
  status?: string
): Promise<CalendarEventRow[]> => {
  const now = new Date().toISOString();
  const defaultFrom = from || now;
  const defaultTo = to || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  if (usingPostgres()) {
    const pool = getPgPool();
    let query = `
      SELECT * FROM calendar_events
      WHERE start_at >= $1 AND start_at <= $2
    `;
    const params: any[] = [defaultFrom, defaultTo];
    
    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }
    
    query += ' ORDER BY start_at ASC';
    
    const res = await pool.query(query, params);
    return res.rows as CalendarEventRow[];
  }

  const db = await getSqliteDb();
  let query = `
    SELECT * FROM calendar_events
    WHERE start_at >= ? AND start_at <= ?
  `;
  const params: any[] = [defaultFrom, defaultTo];
  
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  
  query += ' ORDER BY start_at ASC';
  
  return db.all<CalendarEventRow[]>(query, params);
};

/**
 * Update calendar event status
 */
export const updateCalendarEventStatus = async (
  matchKey: string,
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `UPDATE calendar_events SET status = $1, updated_at = NOW() WHERE match_key = $2`,
      [status, matchKey],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `UPDATE calendar_events SET status = ?, updated_at = datetime('now') WHERE match_key = ?`,
    [status, matchKey],
  );
};

/**
 * Generate iCal data for an event
 */
export const generateICal = (event: CalendarEventInput): string => {
  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Inzerty//Calendar//EN',
    'BEGIN:VEVENT',
    `UID:${event.matchKey}-${event.eventType}@inzerty`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART:${event.startAt.replace(/[-:]/g, '').split('.')[0]}Z`,
    event.endAt ? `DTEND:${event.endAt.replace(/[-:]/g, '').split('.')[0]}Z` : '',
    `SUMMARY:${event.title}`,
    event.description ? `DESCRIPTION:${event.description}` : '',
    event.location ? `LOCATION:${event.location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  return ical;
};

/**
 * Delete calendar event
 */
export const deleteCalendarEvent = async (matchKey: string): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(`DELETE FROM calendar_events WHERE match_key = $1`, [matchKey]);
    return;
  }

  const db = await getSqliteDb();
  await db.run(`DELETE FROM calendar_events WHERE match_key = ?`, [matchKey]);
};

/**
 * Get calendar events by status
 */
export const getCalendarEventsByStatus = async (
  status: string,
  limit = 100
): Promise<CalendarEventRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM calendar_events WHERE status = $1 ORDER BY start_at ASC LIMIT $2`,
      [status, limit],
    );
    return res.rows as CalendarEventRow[];
  }

  const db = await getSqliteDb();
  return db.all<CalendarEventRow[]>(
    `SELECT * FROM calendar_events WHERE status = ? ORDER BY start_at ASC LIMIT ?`,
    [status, limit],
  );
};
