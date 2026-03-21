# 📋 Souhrnný plán refaktorování projektu

## 🎯 Přehled

Tento dokument shrnuje plány refaktorování pro všechny velké soubory (>250 řádků) v projektu "Český Inzertní Scraper UI".

---

## 📊 Identifikované soubory k refaktorování

### Backend (>250 řádků)

| Soubor | Řádky | Priorita | Status |
|--------|-------|----------|--------|
| `backend/src/index.ts` | 5316 | 🔴 Kritická | Plán hotov |
| `backend/src/database.ts` | 3052 | 🔴 Kritická | Plán hotov |
| `backend/src/scrapers/BaseScraper.ts` | 337 | 🟡 Střední | Nutno rozdělit |
| `backend/src/websocket.ts` | 218 | 🟡 Střední | Nutno zjednodušit |

### Frontend (>250 řádků)

| Soubor | Řádky | Priorita | Status |
|--------|-------|----------|--------|
| `components/ResultsDisplay.tsx` | 1121 | 🔴 Kritická | Plán hotov |
| `App.tsx` | 466 | 🟡 Střední | Plán hotov |
| `components/SettingsPage.tsx` | 452 | 🟡 Střední | Nutno rozdělit |
| `components/PriorityWeightsPanel.tsx` | 374 | 🟢 Nízká | Plánován |
| `components/FraudThresholdsPanel.tsx` | 324 | 🟢 Nízká | Plánován |
| `components/PriorityDashboard.tsx` | 309 | 🟢 Nízká | Plánován |
| `components/NegotiationHistory.tsx` | 298 | 🟢 Nízká | Plánován |
| `components/MeetingReminders.tsx` | 281 | 🟢 Nízká | Plánován |
| `components/FollowUpCalendar.tsx` | 274 | 🟢 Nízká | Plánován |
| `components/NegotiationInterface.tsx` | 271 | 🟢 Nízká | Plánován |
| `components/MatchPriority.tsx` | 268 | 🟢 Nízká | Plánován |
| `components/FraudDashboard.tsx` | 264 | 🟢 Nízká | Plánován |
| `components/AutoPrioritizationPanel.tsx` | 263 | 🟢 Nízká | Plánován |
| `components/AutomationControls.tsx` | 251 | 🟢 Nízká | Plánován |

---

## 🏗️ Architektura po refaktorování

### Backend struktura

```
backend/src/
├── index.ts                    # < 100 řádků, pouze bootstrap
├── app.ts                      # Express app setup
├── database.ts                 # Re-exports z database/
├── routes/                     # API routes
│   ├── index.ts
│   ├── scraping.routes.ts
│   ├── matches.routes.ts
│   ├── fraud.routes.ts
│   └── ...
├── controllers/                # Business logic pro endpointy
│   ├── scraping.controller.ts
│   ├── matches.controller.ts
│   └── ...
├── services/                   # Čistá business logika
│   ├── scraping.service.ts
│   ├── matching.service.ts
│   ├── fraud-detection.service.ts
│   └── ...
├── repositories/               # DB operace (v database/repositories/)
├── middleware/                 # Express middleware
├── validators/                 # Request validace
├── utils/                      # Helper funkce
├── scrapers/                   # Scraping implementace
└── websocket/                  # WebSocket logika
```

### Frontend struktura

```
src/
├── App.tsx                     # < 100 řádků, pouze routing
├── components/
│   ├── Layout/                 # Layout komponenty
│   ├── views/                  # Celé view komponenty
│   ├── MatchCard/              # Karta matche
│   ├── MatchFilters/           # Filtry
│   ├── MatchList/              # Seznam matchů
│   ├── ExportPanel/            # Export funkcionalita
│   ├── AlertsPanel/            # Alerts konfigurace
│   └── ...
├── hooks/                      # Custom React hooks
│   ├── useAppState.ts
│   ├── useScraping.ts
│   ├── useComparison.ts
│   ├── useMatchFilters.ts
│   ├── useMatchMeta.ts
│   └── ...
└── services/                   # API volání a logika
    ├── messageTemplates.ts
    ├── automation.service.ts
    └── ...
```

---

## 📅 Celkový harmonogram

### Fáze 1: Backend - Kritické soubory (7-10 dní)

| Den | Úkol | Výstup |
|-----|------|--------|
| 1-2 | `index.ts` → routes, controllers, services | `routes/`, `controllers/`, `services/` |
| 3-4 | `database.ts` → repositories, connection, schema | `database/connection.ts`, `database/schema.ts`, `database/repositories/` |
| 5 | Utils extrakce | `utils/logger.ts`, `utils/cache.ts`, `utils/ollama-manager.ts` |
| 6-7 | Middleware a validators | `middleware/`, `validators/` |
| 8-9 | Integrace a testování | Funkční backend |
| 10 | Cleanup a dokumentace | Aktualizované README |

### Fáze 2: Frontend - Kritické soubory (6-8 dní)

| Den | Úkol | Výstup |
|-----|------|--------|
| 1-2 | `ResultsDisplay.tsx` → hooks, components | `hooks/useMatch*.ts`, `components/MatchCard/` |
| 3 | `App.tsx` → hooks, views | `hooks/use*.ts`, `components/views/` |
| 4 | Layout komponenty | `components/Layout/` |
| 5-6 | Integrace a testování | Funkční frontend |
| 7-8 | Cleanup a optimalizace | Menší bundle size |

### Fáze 3: Sekundární soubory (5-7 dní)

| Den | Úkol | Výstup |
|-----|------|--------|
| 1-2 | `SettingsPage.tsx` rozdělení | `components/Settings/` |
| 3-4 | Priority komponenty | `components/Priority/` |
| 5-6 | Fraud/Negotiation komponenty | `components/Fraud/`, `components/Negotiation/` |
| 7 | Testování a dokumentace | Vše funkční |

---

## 📈 Metriky úspěchu

### Před refaktorováním

| Metrika | Hodnota |
|---------|---------|
| Největší soubor | 5316 řádků (index.ts) |
| Průměrná velikost | ~400 řádků |
| Soubory > 500 řádků | 2 |
| Soubory > 250 řádků | 22 |
| Test coverage | ~0% |
| Čas na přidání feature | 4-8 hodin |

### Cíle po refaktorování

| Metrika | Cíl |
|---------|-----|
| Největší soubor | < 300 řádků |
| Průměrná velikost | < 150 řádků |
| Soubory > 500 řádků | 0 |
| Soubory > 250 řádků | 0-2 |
| Test coverage | > 60% |
| Čas na přidání feature | 1-2 hodiny |

---

## ⚠️ Rizika a mitigace

### Rizika

1. **Ztráta funkcionality** - Některé features přestanou fungovat
2. **Regrese** - Staré bugy se vrátí v nové formě
3. **Časová náročnost** - Refaktorování zabere více času než plánováno
4. **Team alignment** - Všichni musí pochopit novou strukturu

### Mitigace

1. **Kompletní testování** - Před nasazením otestovat všechny cesty
2. **Postupné nasazování** - Nasazovat po menších částech
3. **Dokumentace** - Detailní dokumentace každé změny
4. **Code review** - Každá změna projde review
5. **Rollback plán** - Možnost rychle se vrátit k předchozí verzi

---

## 🧪 Testovací strategie

### Unit testy

```typescript
// Příklad: test pro scraping.service.ts
describe('ScrapingService', () => {
  it('should scrape single platform', async () => {
    const service = new ScrapingService(mockScraperFactory);
    const result = await service.scrapePlatform('bazos_cz', options);
    expect(result.offers.length).toBeGreaterThan(0);
  });
});
```

### Integration testy

```typescript
// Příklad: test pro /scrape-all endpoint
describe('POST /scrape-all', () => {
  it('should return scraped ads', async () => {
    const response = await request(app)
      .post('/api/scrape-all')
      .send({ selectors: mockSelectors });
    expect(response.status).toBe(200);
    expect(response.body.data.nabidkaCount).toBeGreaterThan(0);
  });
});
```

### E2E testy

```typescript
// Příklad: Playwright test pro celý scraping proces
test('complete scraping flow', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.click('[data-testid="start-scraping"]');
  await expect(page.locator('[data-testid="scrape-summary"]')).toBeVisible();
});
```

---

## 📚 Dokumentace

### Pro každý refaktorovaný soubor vytvořit:

1. **README.md** v každé nové složce
2. **API documentation** pro všechny services
3. **Migration guide** pro vývojáře
4. **Changelog** entry pro každou fázi

---

## ✅ Checklist před nasazením

- [ ] Všechny unit testy passing
- [ ] Všechny integration testy passing
- [ ] E2E testy pro kritické cesty
- [ ] TypeScript kompilace bez chyb
- [ ] Linting bez warningů
- [ ] Performance testy (žádná regrese)
- [ ] Dokumentace aktualizována
- [ ] Team prošel školením nové struktury
- [ ] Rollback plán připraven
- [ ] Monitoring a logging funkční

---

## 🎯 Další kroky

1. **Schválení plánu** - Projít s teamem a získat feedback
2. **Prioritizace** - Začít s kritickými soubory
3. **Časové bloky** - Rezervovat čas v kalendáři
4. **Branch strategie** - Vytvořit `refactor/main` branch
5. **PR šablony** - Připravit šablony pro code review

---

*Vygenerováno: 2026-03-16*  
*Autor: Autonomous Lead Fullstack Developer*

*Další dokumenty:*
- [01-backend-index-ts.md](./01-backend-index-ts.md) - Detailní plán pro index.ts
- [02-backend-database-ts.md](./02-backend-database-ts.md) - Detailní plán pro database.ts
- [03-frontend-ResultsDisplay-tsx.md](./03-frontend-ResultsDisplay-tsx.md) - Detailní plán pro ResultsDisplay.tsx
- [04-frontend-App-tsx.md](./04-frontend-App-tsx.md) - Detailní plán pro App.tsx
