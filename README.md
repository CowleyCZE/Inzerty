# Český Inzertní Scraper UI 🔍📱

Webová aplikace pro scrapování a porovnávání inzerátů mobilních telefonů z českých inzertních portálů (bazos.cz).

![GHBanner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

## 📋 Popis

Aplikace automaticky scrapuje inzeráty mobilních telefonů z webu mobil.bazos.cz, rozděluje je na nabídky (prodej) a poptávky (koupě), a následně hledá příležitosti, kde cena poptávky je vyšší než cena nabídky pro stejnou značku telefonu.

### Hlavní funkce

- **Automatické scrapování** - Sbírá inzeráty z bazos.cz pro různé značky telefonů (Samsung, Apple, Huawei, Motorola, Nokia, Sony, Xiaomi)
- **Porovnávání nabídek a poptávek** - Identifikuje příležitosti pro profit
- **Moderní UI** - React aplikace s Tailwind CSS
- **Etické zásady** - Zobrazuje doporučení pro odpovědné scrapování

## 🏗️ Architektura

```
Frontend (React + Vite)     Backend (Express + TypeScript)
        │                            │
        ├── Tailwind CSS             ├── Cheerio (HTML parsing)
        ├── TypeScript               ├── Axios (HTTP requests)
        └── Gemini AI (optional)     └── CORS enabled
```

## 🛠️ Technologie

**Frontend:**
- React 19
- TypeScript
- Vite
- Tailwind CSS (CDN)
- @google/genai (volitelně pro mock data)

**Backend:**
- Node.js + Express 5
- TypeScript
- Cheerio (web scraping)
- Axios

## 🚀 Instalace a spuštění

### Požadavky
- Node.js (v18 nebo novější)
- npm

### 1. Instalace závislostí

```bash
# Frontend
npm install

# Backend
cd backend
npm install
```

### 2. Konfigurace (volitelné)

Pro použití Gemini AI pro generování mock dat vytvořte soubor `.env.local`:

```env
VITE_API_KEY=váš_gemini_api_klíč
```

### 3. Spuštění

```bash
# Backend (terminál 1)
cd backend
npm run dev

# Frontend (terminál 2)
npm run dev
```

Aplikace bude dostupná na `http://localhost:5173`, backend na `http://localhost:3001`.

## 📖 Použití

1. **Start Scraping** - Klikněte pro zahájení scrapování inzerátů
2. Aplikace stáhne inzeráty pro všechny značky telefonů
3. **Start Comparison** - Po dokončení scrapování porovnejte nabídky s poptávkami
4. Zobrazí se nalezené shody s rozdílem cen

## 📁 Struktura projektu

```
Inzer-ty/
├── components/          # React komponenty
│   ├── Header.tsx
│   ├── ResultsDisplay.tsx
│   ├── MonitoringDashboard.tsx
│   └── ...
├── services/            # Služby (Gemini AI)
├── backend/             # Express server
│   ├── src/index.ts     # API endpoints
│   └── scraped_data/    # Uložená data
├── App.tsx              # Hlavní aplikace
├── types.ts             # TypeScript typy
└── constants.ts         # Konstanty
```

## ⚠️ Etické zásady scrapování

- Respektujte soubor robots.txt
- Omezte frekvenci požadavků
- Sbírejte pouze veřejně dostupná data
- Dodržujte GDPR a autorská práva

## 📄 Licence

Tento projekt je určen pro demonstrační a vzdělávací účely.

---

© 2025 Český Inzertní Scraper
