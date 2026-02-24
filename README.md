# Český Inzertní Scraper UI (Bazoš Arbitráž)

Aplikace pro **scraping inzerátů**, jejich porovnávání (nabídka vs. poptávka) a hledání arbitrážních příležitostí.

---

## 1) Rychlý start (nejjednodušší varianta)

> Doporučeno pro začátek: **SQLite + bez proxy + volitelně Ollama**.

### Krok 1: Instalace Node.js
- Nainstalujte Node.js (doporučeno LTS, min. v18).
- Ověřte:

```bash
node -v
npm -v
```

### Krok 2: Instalace závislostí

```bash
# root projektu
npm install

# backend
cd backend
npm install
```

### Krok 3: Spuštění backendu

```bash
cd backend
npm start
```

Backend poběží na `http://localhost:3001`.

### Krok 4: Spuštění frontendu

```bash
# v rootu projektu
npm run dev
```

Frontend poběží na `http://localhost:5173`.

---

## 2) Ollama – kompletní step-by-step

### Instalace Ollama
- Web: https://ollama.com/download
- Nainstalujte podle OS (Windows/macOS/Linux).

### Výběr modelu
Doporučeno začít modelem:
- `llama3.2:1b` (rychlý, nízké nároky)

Případně kvalitnější, ale náročnější:
- `llama3.1:8b`
- `mistral:7b`

### Stažení modelu

```bash
ollama pull llama3.2:1b
```

### Spuštění Ollama serveru

```bash
ollama serve
```

### Nastavení backendu na Ollama endpoint

```bash
# Linux/macOS
export OLLAMA_URL="http://localhost:11434"

# Windows PowerShell
$env:OLLAMA_URL="http://localhost:11434"
```

### Zapnutí AI v aplikaci
- V horní liště klikněte na přepínač **AI Server ON/OFF**.
- V porovnání použijte AI/Auto režim.

### Vypnutí Ollama
- V aplikaci přepnout na **OFF**, nebo
- v terminálu ukončit proces `ollama serve` (`Ctrl+C`).

---

## 3) PostgreSQL – kompletní step-by-step

> PostgreSQL je vhodné pro větší data a budoucí škálování.

### Instalace PostgreSQL
- Windows: použijte oficiální installer (postgresql.org)
- Linux: přes balíčkovací systém (apt/yum/pacman)

### Vytvoření DB (příklad)

```sql
CREATE DATABASE inzerty;
```

### Nastavení připojení

```bash
# Linux/macOS
export DB_CLIENT=postgres
export DATABASE_URL="postgresql://postgres:heslo@localhost:5432/inzerty"

# Windows PowerShell
$env:DB_CLIENT="postgres"
$env:DATABASE_URL="postgresql://postgres:heslo@localhost:5432/inzerty"
```

### Spuštění backendu

```bash
cd backend
npm start
```

Backend si tabulky vytvoří automaticky při startu.

### pgvector (volitelně)
Pokud chcete DB výpočty vektorové podobnosti:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Aplikace se pokusí pgvector aktivovat automaticky; když není dostupný, použije fallback v Node.js.

---

## 4) Proxy pool pro scraper – step-by-step

> Proxy jsou volitelné. Hodí se při častém scrapingu.

### Kde získat proxy
Běžný postup:
1. Registrace u proxy providera (např. datacenter/residential).
2. Vygenerování endpointů (IP:PORT, případně user/pass).
3. Otestování endpointů mimo aplikaci (curl, browser, script).

### Nastavení v aplikaci
Do proměnné `SCRAPER_PROXY_URLS` zadejte více proxy oddělených čárkou:

```bash
# Linux/macOS
export SCRAPER_PROXY_URLS="http://user:pass@proxy1:8080,http://user:pass@proxy2:8080"

# Windows PowerShell
$env:SCRAPER_PROXY_URLS="http://user:pass@proxy1:8080,http://user:pass@proxy2:8080"
```

Scraper proxy rotuje náhodně mezi požadavky.

---

## 5) Jak uživateli co nejvíce ulehčit nastavení

Aplikace obsahuje stránku **Nastavení**:
- přepnutí SQLite/PostgreSQL,
- vyplnění Ollama URL + modelu,
- zapnutí/vypnutí proxy poolu,
- generátor `.env` hodnot k okamžitému zkopírování.

Doporučený postup pro běžného uživatele:
1. Nechat SQLite.
2. Spustit `ollama serve` + model `llama3.2:1b`.
3. Proxy nechat vypnuté.
4. Spustit scraping a následně comparison.

---

## 6) Co aplikace aktuálně umí

- Inkrementální scraping (checkpoint URL + datum).
- Retry/backoff + jitter + anti-bot prvky.
- Výpočet arbitrážního skóre.
- Řazení/filtrování výsledků na frontendu.
- Volitelný PostgreSQL režim s přípravou na pgvector.

---

## 7) Troubleshooting

### Chyba: `npm start` v backendu nefunguje
Ujistěte se, že jste ve složce `backend` a že máte aktuální verzi repozitáře.

```bash
cd backend
npm install
npm start
```

### Chyba: `table ads has no column named embedding`
Byla opravena migrací při startu backendu (automatické doplnění chybějících sloupců). Pokud máte velmi starou DB, stačí restart backendu.

### Ollama nereaguje
- Ověřte běh `ollama serve`.
- Zkontrolujte `OLLAMA_URL`.
- Otestujte endpoint: `http://localhost:11434/api/tags`.

---

## 8) Etika a právní rámec

Scrapujte ohleduplně:
- nepřetěžujte cílové servery,
- respektujte podmínky webu,
- nepracujte s citlivými daty bez právního důvodu.
