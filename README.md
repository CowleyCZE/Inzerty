# Český Inzertní Scraper UI (Bazoš Arbitráž)

Webová aplikace pro **scrapování, ukládání a porovnávání inzerátů** mobilních telefonů (nabídka vs. poptávka) z Bazoš.cz. Cíl je najít **arbitrážní příležitosti** (koupit levněji, prodat dráž) a rovnou ukázat potenciální zisk.

---

## 📋 Funkce aplikace

### ✅ Inkrementální scraping
- Scraper automaticky ukládá checkpointy (`brand + ad_type`)
- Při dalším běhu stahuje jen nové inzeráty
- Umí se zastavit na posledním známém URL a/nebo datu
- Omezuje zbytečné requesty při častém spouštění

### ✅ Spolehlivější scraping
- Rotace `User-Agent` headers
- Náhodné zpoždění mezi požadavky
- Retry logika + exponenciální backoff + jitter pro chyby (`429/5xx/408` a síťové chyby)
- Volitelná **proxy rotace** přes `SCRAPER_PROXY_URLS`

### ✅ Porovnání inzerátů (AI / bez AI)
- **Lokální keyword režim** – základní textové porovnání
- **AI režim** – využívá Ollama (`llama3.2:1b`) s embeddingy pro pokročilé porovnání
- **Auto režim** – automaticky se přepíná podle dostupnosti Ollama

### ✅ Arbitrážní skóre
- Backend počítá `arbitrageScore = demandPrice - offerPrice`
- Frontend umí filtrovat minimální zisk
- Řazení výsledků podle výnosnosti

### ✅ Škálování přes PostgreSQL + pgvector
- **Výchozí režim:** SQLite (bezstarostné spuštění bez konfigurace)
- **Volitelně:** PostgreSQL s pgvector pro výpočty podobnosti přímo v databázi
- `DB_CLIENT=postgres` + `DATABASE_URL` pro přepnutí

---

## 💻 Technologie

| Vrstva | Stack |
|--------|-------|
| **Frontend** | React 19, TypeScript, Vite |
| **Backend** | Node.js, Express, Axios, Cheerio |
| **Databáze** | SQLite (default), PostgreSQL (volitelně) |
| **AI** | Ollama (llama3.2:1b) |
| **Jazyk** | TypeScript (97.9%) |

---

## 🚀 Instalace

### Krok 1: Instalace Node.js

Ujistěte se, že máte nainstalovaný **Node.js LTS** (min. verze 18):

```bash
# Ověřte verze
node -v
npm -v
```

### Krok 2: Klonování repositáře a instalace závislostí

```bash
# Klonujte projekt
git clone https://github.com/CowleyCZE/Inzerty.git
cd Inzerty

# Instalace frontend závislostí (root adresář)
npm install

# Instalace backend závislostí
cd backend
npm install
cd ..
```

---

## ▶️ Spuštění aplikace

### Backend server

```bash
cd backend
npm start
# Server běží na http://localhost:3001
```

### Frontend (v novém terminálu)

```bash
# V rootu projektu
npm run dev
# Aplikace běží na http://localhost:5173
```

Po spuštění obou komponent:
- Backend API: `http://localhost:3001`
- Frontend UI: `http://localhost:5173`

---

## ⚙️ Konfigurace

Všechny nastavení se provádějí přes **environment proměnné** v souboru `.env` v `backend/` adresáři.

### 1️⃣ Výchozí konfigurace (SQLite - bez nastavení)

```bash
# Není potřeba nic nastavovat!
# Aplikace automaticky použije SQLite databázi: backend/inzerty.db
```

### 2️⃣ PostgreSQL (volitelné)

Pokud chcete používat PostgreSQL místo SQLite:

#### Instalace PostgreSQL (Linux/macOS)

**macOS (Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
- Stáhněte z [postgresql.org](https://www.postgresql.org/download/windows/)
- Spusťte instalátor

#### Vytvoření databáze

```bash
# Přihlášení do PostgreSQL
psql -U postgres

# V PostgreSQL terminálu:
CREATE DATABASE inzerty;
CREATE USER inzerty_user WITH PASSWORD 'tvoje_hesla';
ALTER ROLE inzerty_user SET client_encoding TO 'utf8';
ALTER ROLE inzerty_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE inzerty_user SET default_transaction_deferrable TO on;
GRANT ALL PRIVILEGES ON DATABASE inzerty TO inzerty_user;
\q
```

#### Konfigurace v .env

Vytvořte nebo upravte soubor `backend/.env`:

```bash
# Databáze
DB_CLIENT=postgres
DATABASE_URL="postgresql://inzerty_user:tvoje_hesla@localhost:5432/inzerty"

# Volitelně: Pokud chcete pgvector pro AI podobnosti
# ENABLE_PGVECTOR=true
```

#### Instalace pgvector (pokročilé)

```bash
# V PostgreSQL terminálu
psql -U postgres -d inzerty

# Vytvoření extension
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

Pak v `backend/.env` aktivujte:
```bash
ENABLE_PGVECTOR=true
```

---

### 3️⃣ Ollama - AI porovnání inzerátů

Pokud chcete používat AI pro inteligentní porovnání inzerátů:

#### Instalace Ollama

**macOS / Windows / Linux:**
- Stáhněte z [ollama.ai](https://ollama.ai)
- Spusťte instalátor

#### Spuštění Ollama s modelem

```bash
# Ollama by měla být spuštěna na pozadí
# Stáhněte a spusťte model
ollama pull llama3.2:1b
ollama serve
# Běží na http://localhost:11434
```

#### Konfigurace v .env

```bash
# V backend/.env
OLLAMA_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.2:1b"

# Volitelně: režim porovnání
# MODE=ai        # Pouze AI porovnání
# MODE=keyword   # Pouze keyword porovnání
# MODE=auto      # Automaticky přepíná (default)
```

#### Ověření, že Ollama funguje

```bash
curl http://localhost:11434/api/tags
# Měl by vrátit seznam dostupných modelů
```

---

### 4️⃣ Proxy pool pro scraper (volitelné)

Pokud chcete rotovat proxy servery pro scraping:

#### Konfigurace v .env

```bash
# Backend/.env
SCRAPER_PROXY_URLS="http://user:pass@proxy1:8080,http://proxy2:8080,socks5://proxy3:1080"
```

#### Příklady proxy formátů

```bash
# HTTP proxy
SCRAPER_PROXY_URLS="http://10.0.0.1:8080"

# HTTP proxy s autentizací
SCRAPER_PROXY_URLS="http://username:password@proxy.example.com:8080"

# Více proxy (oddělené čárkou)
SCRAPER_PROXY_URLS="http://proxy1:8080,http://proxy2:8080,http://proxy3:8080"

# SOCKS5 proxy
SCRAPER_PROXY_URLS="socks5://proxy.example.com:1080"

# Mix různých typů
SCRAPER_PROXY_URLS="http://proxy1:8080,socks5://proxy2:1080,http://user:pass@proxy3:8080"
```

#### Testování proxy

```bash
# Otestujte, zda proxy fungují
curl -x http://user:pass@proxy:8080 https://www.baos.cz
```

---

## 📝 Příklad .env souboru

Vytvořte soubor `backend/.env` s následujícím obsahem:

```bash
# ===== DATABASE =====
# SQLite (default)
# DB_CLIENT=sqlite
# DATABASE_URL=./inzerty.db

# PostgreSQL (volitelné)
DB_CLIENT=postgres
DATABASE_URL="postgresql://inzerty_user:tvoje_hesla@localhost:5432/inzerty"

# ===== OLLAMA (AI) =====
OLLAMA_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.2:1b"
# MODE=auto  # auto, ai, keyword

# ===== PROXY (volitelné) =====
# SCRAPER_PROXY_URLS="http://proxy1:8080,http://proxy2:8080"

# ===== SERVER =====
NODE_ENV=development
PORT=3001
```

---

## 🔧 Řešení problémů

### Backend se nespustí
```bash
# Ověřte, že Node.js je nainstalován
node -v

# Smazat node_modules a reinstalovat
rm -rf node_modules package-lock.json
npm install
```

### PostgreSQL nejedná
```bash
# Ověřte, zda PostgreSQL běží
sudo systemctl status postgresql

# Otestujte připojení
psql -U postgres -d inzerty
```

### Ollama se nespojuje
```bash
# Ověřte, zda Ollama běží
curl http://localhost:11434/api/tags

# Restartujte Ollama
ollama serve
```

### Proxy nefungují
```bash
# Otestujte proxy bez aplikace
curl -x http://proxy:8080 https://www.google.com

# Ověřte formát v .env (bez uvozovek, pokud není mezera)
SCRAPER_PROXY_URLS=http://proxy1:8080,http://proxy2:8080
```

---

## 📌 Poznámky

⚠️ **Důležité:** Scrapování cizích webů provádějte ohleduplně:
- Respektujte `robots.txt` a terms of service
- Používejte rozumnou frekvenci (nespamujte server)
- Zvažte dopad na provoz cílového webu
- Mějte vypnuté proxy během vývoje pro ladění

---

## 📞 Podpora

Máte problém? Otevřete [Issue](https://github.com/CowleyCZE/Inzerty/issues) na GitHubu.