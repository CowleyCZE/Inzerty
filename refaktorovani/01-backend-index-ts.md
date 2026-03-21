# Plán refaktorování: backend/src/index.ts

## 📊 Stav

- **Počet řádků**: 5316
- **Hlavní zodpovědnosti**: 
  - Express API server (103 endpointů)
  - Scraping logika
  - AI integrace (Ollama)
  - Cache management
  - Runtime logging
  - Ollama server management
  - Alert notifikace
  - Export funkcionalita

## ⚠️ Problémy

1. **Extrémní velikost** - 5316 řádků je neudržitelných
2. **Jeden soubor dělá vše** - API routes, business logic, scraping, AI
3. **Žádná separace concernů** - Všechno v jednom souboru
4. **Těžké testování** - Nelze izolovat jednotlivé funkce
5. **Opakující se kód** - Mnoho endpointů sdílí podobnou strukturu

## 📋 Navrhované rozdělení

### 1. `/backend/src/routes/index.ts` (Nová složka)
**Responsibility**: Definice všech API routes

```
routes/
├── index.ts              # Hlavní router
├── ollama.routes.ts      # /ollama/* endpointy
├── settings.routes.ts    # /settings endpointy
├── scraping.routes.ts    # /scrape-all, /scrape-all-multi
├── matches.routes.ts     # /matches/*, /match-meta/*
├── compare.routes.ts     # /compare endpoint
├── alerts.routes.ts      # /alerts/* endpointy
├── export.routes.ts      # /export/* endpointy
├── followups.routes.ts   # /followups/* endpointy
├── templates.routes.ts   # /templates/* endpointy
├── ai.routes.ts          # /ai/* endpointy
├── conversations.routes.ts # /conversations/* endpointy
├── deals.routes.ts       # /deals/* endpointy
├── fraud.routes.ts       # /fraud/* endpointy
├── watchlist.routes.ts   # /watchlist/* endpointy
├── negotiation.routes.ts # /negotiation/* endpointy
├── priority.routes.ts    # /priority/* endpointy
├── email.routes.ts       # /email/* endpointy
├── calendar.routes.ts    # /calendar/* endpointy
├── meeting.routes.ts     # /meeting/* endpointy
├── analytics.routes.ts   # /analytics/* endpointy
├── cache.routes.ts       # /cache/* endpointy
├── automation.routes.ts  # /automation/* endpointy
├── logs.routes.ts        # /logs/* endpointy
└── database.routes.ts    # /database/* endpointy
```

**Příklad struktury route souboru** (`scraping.routes.ts`):
```typescript
import { Router } from 'express';
import { scrapeAllController } from '../controllers/scraping.controller.js';

const router = Router();

router.post('/scrape-all', scrapeAllController);
router.post('/scrape-all-multi', scrapeAllMultiController);

export default router;
```

---

### 2. `/backend/src/controllers/` (Nová složka)
**Responsibility**: Business logic pro každý endpoint

```
controllers/
├── scraping.controller.ts    # Logika scrapování
├── compare.controller.ts     # Porovnávání inzerátů
├── fraud.controller.ts       # Fraud detection logika
├── negotiation.controller.ts # Vyjednávání logika
├── priority.controller.ts    # Priority scoring logika
├── meeting.controller.ts     # Meeting scheduler logika
├── analytics.controller.ts   # Analytics logika
├── alerts.controller.ts      # Alert notifikace
├── export.controller.ts      # Export CSV/Sheets
├── automation.controller.ts  # Autonomous process
└── ...
```

**Příklad** (`scraping.controller.ts`):
```typescript
import { ScraperFactory } from '../scrapers/index.js';
import { saveAd } from '../database.js';
import { pushRuntimeLog } from '../utils/logger.js';

export const scrapeAllController = async (req, res) => {
  const { selectors, scrapingOptions } = req.body;
  // ... business logic
};
```

---

### 3. `/backend/src/services/` (Nová složka)
**Responsibility**: Čistá business logika bez HTTP kontextu

```
services/
├── scraping.service.ts       # Scraping orchestrace
├── matching.service.ts       # Matching algoritmy
├── fraud-detection.service.ts # AI fraud detection
├── priority.service.ts       # Priority scoring
├── negotiation.service.ts    # Negotiation engine
├── meeting-scheduler.service.ts # Meeting suggestions
├── analytics.service.ts      # Analytics calculations
├── alert.service.ts          # Alert notifications
├── export.service.ts         # Export logic
├── automation.service.ts     # Autonomous workflow
└── ai.service.ts             # Ollama AI wrapper
```

**Příklad** (`scraping.service.ts`):
```typescript
import { ScraperFactory } from '../scrapers/index.js';
import { AdSource, ScraperResult } from '../types.js';

export class ScrapingService {
  async scrapePlatform(source: AdSource, options: ScrapingOptions): Promise<ScraperResult> {
    const scraper = ScraperFactory.create(source);
    const offers = await scraper.scrape('nabidka', options);
    const demands = await scraper.scrape('poptavka', options);
    return { offers, demands };
  }

  async scrapeAllPlatforms(platforms: AdSource[], options: ScrapingOptions) {
    // Multi-platform orchestration
  }
}
```

---

### 4. `/backend/src/middleware/` (Nová složka)
**Responsibility**: Express middleware

```
middleware/
├── errorHandler.ts     # Global error handling
├── requestLogger.ts    # Logging requestů
├── validateRequest.ts  # Request validace
├── rateLimiter.ts      # Rate limiting
└── cors.ts             # CORS konfigurace
```

---

### 5. `/backend/src/utils/` (Rozšíření)
**Responsibility**: Helper funkce

```
utils/
├── logger.ts           # Runtime logging (extract z index.ts)
├── cache.ts            # AI cache management
├── ollama-manager.ts   # Ollama start/stop logic
├── string.ts           # String helpers
└── date.ts             # Date helpers
```

**Příklad** (`utils/cache.ts`):
```typescript
interface CachedResponse {
  data: any;
  timestamp: number;
  ttl: number;
}

export class AIResponseCache {
  private cache = new Map<string, CachedResponse>();
  private readonly ttl: number;
  private readonly maxEntries: number;

  get(key: string): any | null { /* ... */ }
  set(key: string, data: any, ttl?: number): void { /* ... */ }
  clear(pattern?: string): void { /* ... */ }
}

export const aiResponseCache = new AIResponseCache();
```

---

### 6. `/backend/src/validators/` (Nová složka)
**Responsibility**: Validace request bodů

```
validators/
├── scraping.validator.ts    # Validace scraping options
├── match.validator.ts       # Validace match meta
├── fraud.validator.ts       # Validace fraud flags
├── negotiation.validator.ts # Validace negotiation
└── index.ts                 # Export všech validatorů
```

---

## 🔄 Změny v importech

### Hlavní `index.ts` po refaktorování:
```typescript
import express from 'express';
import cors from 'cors';
import { router } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { initDb } from './database.js';
import { wsService } from './websocket.js';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(requestLogger);
app.use('/api', router);
app.use(errorHandler);

initDb().catch(console.error);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

---

## 📅 Fáze refaktorování

### Fáze 1: Příprava (1-2 dny)
- [ ] Vytvořit strukturu složek
- [ ] Extrahovat logger do `utils/logger.ts`
- [ ] Extrahovat cache do `utils/cache.ts`
- [ ] Extrahovat Ollama manager do `utils/ollama-manager.ts`

### Fáze 2: Services (3-4 dny)
- [ ] Vytvořit `services/scraping.service.ts`
- [ ] Vytvořit `services/matching.service.ts`
- [ ] Vytvořit `services/fraud-detection.service.ts`
- [ ] Vytvořit `services/ai.service.ts`

### Fáze 3: Controllers (2-3 dny)
- [ ] Vytvořit controllery pro hlavní endpointy
- [ ] Propojit services s controllers

### Fáze 4: Routes (2 dny)
- [ ] Rozdělit routes do samostatných souborů
- [ ] Vytvořit hlavní router

### Fáze 5: Cleanup (1-2 dny)
- [ ] Odstranit duplicitní kód
- [ ] Přidat TypeScript typy
- [ ] Otestovat všechny endpointy

---

## ✅ Výhody po refaktorování

1. **Udržitelnost** - Každý soubor < 300 řádků
2. **Testovatelnost** - Lze izolovaně testovat services
3. **Čitelnost** - Jasná separace concernů
4. **Rozšiřitelnost** - Snadné přidávání nových features
5. **Debugging** - Rychlejší nalezení chyb
6. **Team collaboration** - Více lidí může pracovat paralelně

---

*Vygenerováno: 2026-03-16*
*Autor: Autonomous Lead Fullstack Developer*
