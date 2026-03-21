# Plán refaktorování: backend/src/database.ts

## 📊 Stav

- **Počet řádků**: 3052
- **Hlavní zodpovědnosti**:
  - SQLite/PostgreSQL connection management
  - Všechny databázové operace (CRUD)
  - Schéma migrace
  - Vector embedding uložení
  - Transaction management

## ⚠️ Problémy

1. **Příliš mnoho responsibilit** - Connection + všechny operace
2. **Duplicitní kód** - SQLite vs PostgreSQL duplicity
3. **Žádná abstrakce** - Přímo SQL query v funkcích
4. **Těžké testování** - Nelze mockovat DB
5. **Chybí type safety** - `any` typy na mnoha místech

## 📋 Navrhované rozdělení

### 1. `/backend/src/database/connection.ts` (Nový soubor)
**Responsibility**: Connection management

```typescript
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

type DbClient = 'sqlite' | 'postgres';

let sqliteDb: Database | null = null;
let postgresPool: any = null;

export const getSqliteDb = async (): Promise<Database> => {
  if (sqliteDb) return sqliteDb;
  sqliteDb = await open({
    filename: path.join(__dirname, '..', 'inzerty.db'),
    driver: sqlite3.Database,
  });
  await sqliteDb.exec('PRAGMA foreign_keys = ON;');
  return sqliteDb;
};

export const getPgPool = () => {
  if (!postgresPool) {
    const { Pool } = require('pg');
    postgresPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return postgresPool;
};

export const usingPostgres = (): boolean => {
  return process.env.DB_CLIENT === 'postgres';
};

export const closeConnection = async () => {
  if (sqliteDb) await sqliteDb.close();
  if (postgresPool) await postgresPool.end();
};
```

---

### 2. `/backend/src/database/schema.ts` (Nový soubor)
**Responsibility**: Schema definitions a migrace

```typescript
import { Database } from 'sqlite';

export const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    price TEXT,
    price_value REAL,
    location TEXT,
    description TEXT,
    date_posted TEXT,
    url TEXT,
    image_url TEXT,
    ad_type TEXT,
    brand TEXT,
    scraped_at TEXT,
    model_ai TEXT,
    embedding TEXT,
    source TEXT DEFAULT 'bazos_cz',
    external_id TEXT,
    posted_at TEXT,
    seller_info TEXT,
    metadata TEXT,
    UNIQUE(url, ad_type)
  );

  CREATE TABLE IF NOT EXISTS matches (...);
  -- Další tabulky
`;

export const POSTGRES_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    price TEXT,
    price_value DOUBLE PRECISION,
    ...
  );
`;

export const initSchema = async (db: Database | any): Promise<void> => {
  // Inicializace schématu
};

export const migrateSchema = async (db: Database | any): Promise<void> => {
  // Migrace existujícího schématu
};
```

---

### 3. `/backend/src/database/repositories/` (Nová složka)
**Responsibility**: CRUD operace pro každou entitu

```
repositories/
├── ads.repository.ts         # Operace pro inzeráty
├── matches.repository.ts     # Operace pro matches
├── match-meta.repository.ts  # Operace pro match metadata
├── conversations.repository.ts # Konverzace
├── deal-states.repository.ts # Deal states
├── followups.repository.ts   # Follow-ups
├── fraud.repository.ts       # Fraud flags, watchlist
├── negotiation.repository.ts # Negotiation history
├── priority.repository.ts    # Priority weights, capacity
├── email.repository.ts       # Email settings, templates
├── calendar.repository.ts    # Calendar events
├── meeting.repository.ts     # Meeting feedback
├── analytics.repository.ts   # Deal analytics
├── templates.repository.ts   # Message templates
└── checkpoints.repository.ts # Scrape checkpoints
```

**Příklad** (`repositories/ads.repository.ts`):
```typescript
import { getSqliteDb, getPgPool, usingPostgres } from '../connection.js';
import { Ad, AdSource } from '../../types.js';

export interface SaveAdOptions {
  skipIfExists?: boolean;
  updateOnConflict?: boolean;
}

export const saveAd = async (ad: Ad, options?: SaveAdOptions): Promise<boolean> => {
  const rawPrice = ad.price ? parseFloat(ad.price.replace(/[^0-9,-]+/g, '').replace(',', '.')) : null;
  const safePriceValue = rawPrice !== null && !isNaN(rawPrice) ? rawPrice : null;

  if (usingPostgres()) {
    const pool = getPgPool();
    const result = await pool.query(
      `INSERT INTO ads (id, title, price, price_value, location, description, date_posted, url, image_url, ad_type, brand, scraped_at, source, external_id, posted_at, seller_info, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (url, ad_type) DO UPDATE SET 
         source = EXCLUDED.source,
         seller_info = EXCLUDED.seller_info,
         metadata = EXCLUDED.metadata,
         scraped_at = EXCLUDED.scraped_at
       RETURNING id`,
      [ad.id, ad.title, ad.price, safePriceValue, ad.location, ad.description, ad.date_posted, ad.url, ad.image_url, ad.ad_type, ad.brand, ad.scraped_at, ad.source, ad.external_id, ad.posted_at, JSON.stringify(ad.seller), JSON.stringify(ad.metadata)]
    );
    return result.rowCount > 0;
  }

  const db = await getSqliteDb();
  const result = await db.run(
    `INSERT OR IGNORE INTO ads (...) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ad.id, ad.title, ad.price, safePriceValue, ad.location, ad.description, ad.date_posted, ad.url, ad.image_url, ad.ad_type, ad.brand, ad.scraped_at, ad.source, ad.external_id, ad.posted_at, JSON.stringify(ad.seller), JSON.stringify(ad.metadata)]
  );
  return (result.changes ?? 0) > 0;
};

export const getAllAds = async (limit = 1000): Promise<Ad[]> => {
  // ...
};

export const getAdsByType = async (adType: string, limit = 1000): Promise<Ad[]> => {
  // ...
};

export const getAdsByBrand = async (brand: string, adType?: string): Promise<Ad[]> => {
  // ...
};

export const deleteAllAds = async (): Promise<void> => {
  // ...
};
```

---

### 4. `/backend/src/database/query-builders/` (Nová složka)
**Responsibility**: Složité query buildery

```
query-builders/
├── matches.query-builder.ts   # Builder pro matching queries
├── analytics.query-builder.ts # Builder pro analytics queries
├── search.query-builder.ts    # Builder pro fulltext search
└── index.ts                   # Export všech builderů
```

**Příklad** (`query-builders/matches.query-builder.ts`):
```typescript
export class MatchesQueryBuilder {
  private conditions: string[] = [];
  private params: any[] = [];
  private isPostgres: boolean;

  constructor(isPostgres: boolean) {
    this.isPostgres = isPostgres;
  }

  filterByProfit(minProfit: number): this {
    this.conditions.push('m.similarity_score >= ?');
    this.params.push(minProfit);
    return this;
  }

  filterByBrand(brand: string): this {
    this.conditions.push('a.brand = ?');
    this.params.push(brand);
    return this;
  }

  hideResolved(): this {
    this.conditions.push('mm.resolved = FALSE');
    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'DESC'): this {
    this.orderClause = `ORDER BY ${field} ${direction}`;
    return this;
  }

  build(): { sql: string; params: any[] } {
    const baseQuery = `
      SELECT m.*, 
             o.title as offer_title, 
             d.title as demand_title
      FROM matches m
      JOIN ads o ON m.offer_id = o.id
      JOIN ads d ON m.demand_id = d.id
      LEFT JOIN match_meta mm ON m.match_key = mm.match_key
    `;
    
    const whereClause = this.conditions.length > 0 
      ? `WHERE ${this.conditions.join(' AND ')}` 
      : '';

    return {
      sql: `${baseQuery} ${whereClause} ${this.orderClause || ''}`,
      params: this.params,
    };
  }
}
```

---

### 5. `/backend/src/database/transactions.ts` (Nový soubor)
**Responsibility**: Transaction management

```typescript
import { getSqliteDb, getPgPool, usingPostgres } from './connection.js';

export const runTransaction = async <T>(
  callback: (db: any) => Promise<T>
): Promise<T> => {
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
    await db.exec('BEGIN TRANSACTION');
    try {
      const result = await callback(db);
      await db.exec('COMMIT');
      return result;
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  }
};
```

---

### 6. `/backend/src/database/types.ts` (Nový soubor)
**Responsibility**: TypeScript typy pro DB entity

```typescript
export interface AdRow {
  id: string;
  title: string;
  price: string | null;
  price_value: number | null;
  location: string | null;
  description: string | null;
  date_posted: string;
  url: string;
  image_url: string | null;
  ad_type: string;
  brand: string;
  scraped_at: string;
  model_ai: string | null;
  embedding: string | null;
  source: string;
  external_id: string | null;
  posted_at: string | null;
  seller_info: string | null;
  metadata: string | null;
}

export interface MatchRow {
  id: number;
  offer_id: string;
  demand_id: string;
  similarity_score: number;
  is_ai_match: boolean;
  created_at: string;
}

export interface MatchMetaRow {
  match_key: string;
  status: string;
  note: string;
  priority: string;
  last_action_at: string;
  resolved: boolean;
  follow_up_at: string | null;
  follow_up_state: string;
  checklist_json: string | null;
  updated_at: string;
}

// ... další typy
```

---

## 🔄 Změny v importech

### Původní `database.ts` exportuje vše:
```typescript
// Starý způsob
import { saveAd, getAllAds, saveMatch } from './database.js';
```

### Nový způsob:
```typescript
// Repository pattern
import { saveAd, getAllAds } from './database/repositories/ads.repository.js';
import { saveMatch } from './database/repositories/matches.repository.js';

// Nebo přes hlavní export
import { adsRepository, matchesRepository } from './database/index.js';

await adsRepository.save(ad);
await matchesRepository.save(match);
```

---

## 📅 Fáze refaktorování

### Fáze 1: Příprava (1 den)
- [ ] Vytvořit `connection.ts`
- [ ] Vytvořit `schema.ts`
- [ ] Vytvořit `types.ts`

### Fáze 2: Repositories (3-4 dny)
- [ ] `ads.repository.ts`
- [ ] `matches.repository.ts`
- [ ] `match-meta.repository.ts`
- [ ] `conversations.repository.ts`
- [ ] `fraud.repository.ts`
- [ ] `negotiation.repository.ts`
- [ ] `analytics.repository.ts`
- [ ] Ostatní repositories

### Fáze 3: Query Builders (1-2 dny)
- [ ] `matches.query-builder.ts`
- [ ] `analytics.query-builder.ts`

### Fáze 4: Transactions (0.5 dne)
- [ ] `transactions.ts`

### Fáze 5: Migrace (1 den)
- [ ] Postupně přepsat všechny funkce v původním `database.ts`
- [ ] Aktualizovat importy v celém projektu
- [ ] Otestovat všechny operace

### Fáze 6: Cleanup (0.5 dne)
- [ ] Smazat původní `database.ts`
- [ ] Vytvořit `database/index.ts` s re-exports

---

## ✅ Výhody po refaktorování

1. **Separation of Concerns** - Každá entita má vlastní repository
2. **Testovatelnost** - Lze mockovat jednotlivé repositories
3. **Type Safety** - Silné typování pro všechny entity
4. **Opakovaně použitelný kód** - Query builders
5. **Jednodušší migrace** - Schema odděleně
6. **Transaction support** - Centrální management
7. **Dual DB support** - Přehlednější SQLite vs PostgreSQL logika

---

*Vygenerováno: 2026-03-16*
*Autor: Autonomous Lead Fullstack Developer*
