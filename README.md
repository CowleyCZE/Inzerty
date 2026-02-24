# Český Inzertní Scraper UI (Bazoš Arbitráž)

Tato webová aplikace slouží ke scrapování, ukládání a inteligentnímu porovnávání inzerátů mobilních telefonů (nabídka vs. poptávka) z inzertního portálu Bazoš.cz. Hlavním cílem je identifikovat arbitrážní příležitosti – tedy situace, kdy poptávková cena (někdo chce koupit) převyšuje nabídkovou (někdo prodává), a rovnou vypočítat potenciální zisk.

## Hlavní funkce

* **Inkrementální (chytrý) scraping:** Aplikace si pamatuje posledních 10 stažených URL inzerátů od každé značky. Jakmile při procházení Bazoše narazí na již stažený inzerát, automaticky prohledávání ukončí. Zabrání se tak zbytečnému stahování a šetří se čas i data.
* **Anti-bot ochrana a spolehlivost:** Integrovaná rotace `User-Agent` hlaviček, náhodná časová zpoždění mezi požadavky a robustní retry logika pro případ výpadků spojení (zajišťuje stabilní chod i při chybách 503 ze strany serveru).
* **Flexibilní porovnávání (3 režimy):**
    * **Bez AI (Termux / Rychlé):** Porovnávání na základě klíčových slov a přesné shody. Ideální pro spuštění na mobilních zařízeních s Androidem přes Termux bez ztráty výkonu.
    * **Lokální AI (Ollama):** Sémantické párování inzerátů pomocí textových vektorů (embeddings) a extrakce parametrů přes model `llama3.2:1b`. Aplikace dokáže spárovat inzeráty s odlišně formulovaným textem.
    * **Auto:** Automaticky zjistí, zda je Ollama API dostupné, a vybere nejlepší možnou cestu.
* **Výpočet "Arbitrážního skóre":** Backend automaticky počítá hrubý zisk (rozdíl mezi poptávkovou a nabídkovou cenou) u nalezených shod. Výsledky se uživateli na frontendu řadí od nejziskovějších příležitostí s možností filtrace podle minimálního zisku.
* **Multiplatformní design (Windows / Android):** Připraveno pro distribuované zpracování. Můžete provozovat PostgreSQL a AI na PC a scrapovací skripty odesílat z mobilu.

## Architektura a Technologie

* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS.
* **Backend:** Node.js, Express.js, Cheerio (parsování HTML), Axios.
* **Databáze:** PostgreSQL (řeší problémy se zamykáním databáze při asynchronním zápisu dat a je kompatibilní s během na lokální síti).
* **AI:** Ollama (`llama3.2:1b`) integrovaná do backendu přes REST API.

## Instalace a spuštění

### Prerekvizity
1.  **Node.js** (v18 a novější).
2.  **PostgreSQL** (nainstalovaný a běžící na výchozím portu 5432).
3.  **Ollama** s nainstalovaným modelem. Stáhněte model pomocí příkazu:
    `ollama run llama3.2:1b`

### 1. Klonování a instalace závislostí
Stáhněte si repozitář a v příkazové řádce nainstalujte požadované balíčky pro obě části projektu:

```bash
# Instalace závislostí pro frontend (v hlavním adresáři)
npm install

# Instalace závislostí pro backend
cd backend
npm install
npm install pg  # Pro připojení k PostgreSQL
```

### 2. Nastavení prostředí (Environment Variables)
​V závislosti na tom, kde aplikaci spouštíte, můžete využít proměnné prostředí pro směrování na správnou databázi a AI model. (Lze exportovat v terminálu nebo přidat do .env souboru v adresáři backendu).
​Pro lokální běh (např. na Windows PC):
Aplikace má jako výchozí nastavení lokální adresy. V případě jiných přihlašovacích údajů do databáze použijte:

```bash
export DATABASE_URL="postgresql://postgres:heslo@localhost:5432/inzerty"
export OLLAMA_URL="http://localhost:11434"
```

Pro běh v Termuxu s využitím PC na lokální síti:
Kde 192.168.1.50 je IP adresa vašeho PC.

```bash
export DATABASE_URL="postgresql://postgres:heslo@192.168.1.50:5432/inzerty"
export OLLAMA_URL="[http://192.168.1.50:11434](http://192.168.1.50:11434)"
```

### 3. Spuštění
​Start Backendu:

```bash
cd backend
npm start
# Server poběží na adrese http://localhost:3001
```

Start Frontendu:
```bash
# Zpět v hlavním adresáři projektu
npm run dev
# Webové rozhraní poběží na adrese http://localhost:5173
```

Pro uživatele na UNIXových systémech nebo v Termuxu je k dispozici také dávkový skript start_app.sh, který spustí obě služby najednou.
​Upozornění
​Scrapování cizích webových stránek by mělo probíhat ohleduplně. Aplikace sice obsahuje prvky anti-bot ochrany (random delays a rotaci hlaviček), aby server inzertního portálu nepřetížila, i tak je ale doporučeno dodržovat rozumnou frekvenci spouštění nástroje. Aplikace byla vytvořena jako ukázkový a vzdělávací projekt.
