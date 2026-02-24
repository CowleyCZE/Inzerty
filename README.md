# Český Inzertní Scraper UI (Bazoš Arbitráž)

Webová aplikace pro scrapování, ukládání a porovnávání inzerátů mobilních telefonů (nabídka vs. poptávka) z Bazoš.cz. Cíl je najít arbitrážní příležitosti (koupit levněji, prodat dráž) a rovnou ukázat potenciální zisk.

---

- **Inkrementální scraping**
  - scraper ukládá checkpointy (`brand + ad_type`) a při dalším běhu stahuje jen nové inzeráty,
  - umí se zastavit na posledním známém URL a/nebo datu,
  - omezuje zbytečné requesty při častém spouštění.

- **Spolehlivější scraping**
  - rotace `User-Agent`,
  - náhodné zpoždění mezi požadavky,
  - retry + exponenciální backoff + jitter pro `429/5xx/408` a síťové chyby,
  - volitelná proxy rotace přes `SCRAPER_PROXY_URLS`.

- **Porovnání inzerátů (AI / bez AI)**
  - lokální keyword režim,
  - AI režim přes Ollama (`llama3.2:1b`) s embeddingy,
  - auto režim podle dostupnosti Ollama.

- **Arbitrážní skóre**
  - backend počítá `arbitrageScore = demandPrice - offerPrice`,
  - frontend umí filtrovat minimální zisk a řadit výsledky podle výnosnosti.

- **Škálování přes PostgreSQL + pgvector (volitelné)**
  - výchozí režim: SQLite,
  - volitelně `DB_CLIENT=postgres` + `DATABASE_URL`,
  - při dostupném `pgvector` se podobnost umí počítat přímo v DB.

## Technologie

- **Frontend:** React 19, TypeScript, Vite
- **Backend:** Node.js, Express, Axios, Cheerio
- **DB:** SQLite (default), PostgreSQL (volitelně)
- **AI:** Ollama

## Instalace

### 1) Závislosti

```bash
# root (frontend)
npm install

# backend
cd backend
npm install
```

## Spuštění

### Backend

```bash
cd backend
npm start
# běží na http://localhost:3001
```

> `npm start` je nyní dostupný a spouští backend server.

### Frontend

```bash
# v rootu projektu
npm run dev
# běží na http://localhost:5173
```

## Konfigurace (backend env)

### Výchozí (SQLite)

Není potřeba nic nastavovat. Použije se soubor `backend/inzerty.db`.

### Volitelně PostgreSQL

```bash
export DB_CLIENT=postgres
export DATABASE_URL="postgresql://postgres:heslo@localhost:5432/inzerty"
```

### Ollama

```bash
export OLLAMA_URL="http://localhost:11434"
```

### Proxy pool pro scraper (volitelné)

```bash
export SCRAPER_PROXY_URLS="http://user:pass@proxy1:8080,http://proxy2:8080"
```

## Poznámka

Scrapování cizích webů provádějte ohleduplně a s rozumnou frekvencí.
