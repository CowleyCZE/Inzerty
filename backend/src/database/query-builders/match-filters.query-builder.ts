/**
 * Match Filters Query Builder
 * 
 * Builds complex SQL queries for filtering matches based on:
 * - Profit thresholds
 * - Brand filters
 * - Resolved status
 * - Date ranges
 * - Location filters
 */

import { usingPostgres } from '../connection.js';

export interface MatchFilterOptions {
  minProfit?: number;
  maxProfit?: number;
  minSimilarity?: number;
  brands?: string[];
  resolved?: boolean;
  fromDate?: string;
  toDate?: string;
  locations?: string[];
  limit?: number;
  offset?: number;
  orderBy?: 'profit' | 'similarity' | 'date' | 'opportunity_score';
  orderDirection?: 'ASC' | 'DESC';
}

export interface MatchFilterResult {
  query: string;
  params: any[];
}

/**
 * Build a query to filter matches
 */
export const buildMatchFilterQuery = (options: MatchFilterOptions = {}): MatchFilterResult => {
  const isPostgres = usingPostgres();
  
  // Base query with joins
  let query = `
    SELECT
      m.id,
      m.offer_id,
      m.demand_id,
      m.similarity_score,
      m.is_ai_match,
      m.created_at,
      a1.title as offer_title,
      a1.price as offer_price,
      a1.price_value as offer_price_value,
      a1.location as offer_location,
      a1.brand as offer_brand,
      a1.url as offer_url,
      a2.title as demand_title,
      a2.price as demand_price,
      a2.price_value as demand_price_value,
      a2.location as demand_location,
      a2.brand as demand_brand,
      a2.url as demand_url,
      mm.status,
      mm.priority,
      mm.resolved,
      mm.note,
      mm.follow_up_at,
      (a2.price_value - a1.price_value) as arbitrage_score
    FROM matches m
    JOIN ads a1 ON a1.id = m.offer_id
    JOIN ads a2 ON a2.id = m.demand_id
    LEFT JOIN match_meta mm ON mm.match_key = (a1.url || '__' || a2.url)
    WHERE 1=1
  `;

  const params: any[] = [];
  let paramIndex = 1;

  // Profit filter
  if (options.minProfit !== undefined) {
    if (isPostgres) {
      query += ` AND (a2.price_value - a1.price_value) >= $${paramIndex++}`;
    } else {
      query += ` AND (a2.price_value - a1.price_value) >= ?`;
    }
    params.push(options.minProfit);
  }

  if (options.maxProfit !== undefined) {
    if (isPostgres) {
      query += ` AND (a2.price_value - a1.price_value) <= $${paramIndex++}`;
    } else {
      query += ` AND (a2.price_value - a1.price_value) <= ?`;
    }
    params.push(options.maxProfit);
  }

  // Similarity filter
  if (options.minSimilarity !== undefined) {
    if (isPostgres) {
      query += ` AND m.similarity_score >= $${paramIndex++}`;
    } else {
      query += ` AND m.similarity_score >= ?`;
    }
    params.push(options.minSimilarity);
  }

  // Brand filter
  if (options.brands && options.brands.length > 0) {
    if (isPostgres) {
      query += ` AND a1.brand = ANY($${paramIndex}::text[])`;
      params.push(options.brands);
      paramIndex++;
    } else {
      const placeholders = options.brands.map(() => '?').join(',');
      query += ` AND a1.brand IN (${placeholders})`;
      params.push(...options.brands);
    }
  }

  // Resolved filter
  if (options.resolved !== undefined) {
    if (isPostgres) {
      query += ` AND mm.resolved = $${paramIndex++}`;
    } else {
      query += ` AND mm.resolved = ${options.resolved ? 1 : 0}`;
    }
    if (isPostgres) {
      params.push(options.resolved);
    }
  }

  // Date range filter
  if (options.fromDate) {
    if (isPostgres) {
      query += ` AND m.created_at >= $${paramIndex++}`;
      params.push(options.fromDate);
    } else {
      query += ` AND m.created_at >= ?`;
      params.push(options.fromDate);
    }
  }

  if (options.toDate) {
    if (isPostgres) {
      query += ` AND m.created_at <= $${paramIndex++}`;
      params.push(options.toDate);
    } else {
      query += ` AND m.created_at <= ?`;
      params.push(options.toDate);
    }
  }

  // Location filter
  if (options.locations && options.locations.length > 0) {
    if (isPostgres) {
      query += ` AND (a1.location = ANY($${paramIndex}::text[]) OR a2.location = ANY($${paramIndex}::text[]))`;
      params.push(options.locations);
      paramIndex++;
    } else {
      const placeholders = options.locations.map(() => '?').join(',');
      query += ` AND (a1.location IN (${placeholders}) OR a2.location IN (${placeholders}))`;
      params.push(...options.locations, ...options.locations);
    }
  }

  // Ordering
  const orderColumn = getOrderColumn(options.orderBy || 'profit', isPostgres);
  const orderDirection = options.orderDirection || 'DESC';
  query += ` ORDER BY ${orderColumn} ${orderDirection}`;

  // Limit and offset
  if (options.limit !== undefined) {
    if (isPostgres) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    } else {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }
  }

  if (options.offset !== undefined) {
    if (isPostgres) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    } else {
      query += ` OFFSET ?`;
      params.push(options.offset);
    }
  }

  return { query, params };
};

/**
 * Get the ORDER BY column name based on the sort option
 */
const getOrderColumn = (orderBy: string, isPostgres: boolean): string => {
  switch (orderBy) {
    case 'profit':
      return isPostgres ? '(a2.price_value - a1.price_value)' : '(a2.price_value - a1.price_value)';
    case 'similarity':
      return 'm.similarity_score';
    case 'date':
      return 'm.created_at';
    case 'opportunity_score':
      return isPostgres ? '(a2.price_value - a1.price_value) * m.similarity_score / 100' : '(a2.price_value - a1.price_value) * m.similarity_score / 100';
    default:
      return 'm.created_at';
  }
};

/**
 * Build a query to get match statistics
 */
export const buildMatchStatsQuery = (): MatchFilterResult => {
  const isPostgres = usingPostgres();

  const query = isPostgres ? `
    SELECT
      COUNT(*) as total_matches,
      COUNT(DISTINCT m.offer_id) as unique_offers,
      COUNT(DISTINCT m.demand_id) as unique_demands,
      AVG(m.similarity_score) as avg_similarity,
      AVG(a2.price_value - a1.price_value) as avg_profit,
      MAX(a2.price_value - a1.price_value) as max_profit,
      MIN(a2.price_value - a1.price_value) as min_profit,
      COUNT(CASE WHEN mm.resolved = true THEN 1 END) as resolved_count,
      COUNT(CASE WHEN mm.resolved = false THEN 1 END) as unresolved_count
    FROM matches m
    JOIN ads a1 ON a1.id = m.offer_id
    JOIN ads a2 ON a2.id = m.demand_id
    LEFT JOIN match_meta mm ON mm.match_key = (a1.url || '__' || a2.url)
  ` : `
    SELECT
      COUNT(*) as total_matches,
      COUNT(DISTINCT m.offer_id) as unique_offers,
      COUNT(DISTINCT m.demand_id) as unique_demands,
      AVG(m.similarity_score) as avg_similarity,
      AVG(a2.price_value - a1.price_value) as avg_profit,
      MAX(a2.price_value - a1.price_value) as max_profit,
      MIN(a2.price_value - a1.price_value) as min_profit,
      SUM(CASE WHEN mm.resolved = 1 THEN 1 ELSE 0 END) as resolved_count,
      SUM(CASE WHEN mm.resolved = 0 THEN 1 ELSE 0 END) as unresolved_count
    FROM matches m
    JOIN ads a1 ON a1.id = m.offer_id
    JOIN ads a2 ON a2.id = m.demand_id
    LEFT JOIN match_meta mm ON mm.match_key = (a1.url || '__' || a2.url)
  `;

  return { query, params: [] };
};

/**
 * Build a query to get matches grouped by brand
 */
export const buildMatchesByBrandQuery = (limit = 10): MatchFilterResult => {
  const isPostgres = usingPostgres();

  const query = isPostgres ? `
    SELECT
      a1.brand,
      COUNT(*) as match_count,
      AVG(a2.price_value - a1.price_value) as avg_profit,
      AVG(m.similarity_score) as avg_similarity,
      COUNT(CASE WHEN mm.resolved = true THEN 1 END) as resolved_count
    FROM matches m
    JOIN ads a1 ON a1.id = m.offer_id
    JOIN ads a2 ON a2.id = m.demand_id
    LEFT JOIN match_meta mm ON mm.match_key = (a1.url || '__' || a2.url)
    GROUP BY a1.brand
    ORDER BY match_count DESC
    LIMIT $1
  ` : `
    SELECT
      a1.brand,
      COUNT(*) as match_count,
      AVG(a2.price_value - a1.price_value) as avg_profit,
      AVG(m.similarity_score) as avg_similarity,
      SUM(CASE WHEN mm.resolved = 1 THEN 1 ELSE 0 END) as resolved_count
    FROM matches m
    JOIN ads a1 ON a1.id = m.offer_id
    JOIN ads a2 ON a2.id = m.demand_id
    LEFT JOIN match_meta mm ON mm.match_key = (a1.url || '__' || a2.url)
    GROUP BY a1.brand
    ORDER BY match_count DESC
    LIMIT ?
  `;

  return { query, params: [limit] };
};
