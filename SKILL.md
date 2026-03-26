# 🎯 SKILL: Inzerty Development

**Domain**: Full-stack development for Inzerty arbitrage application (React + Node.js + TypeScript)

**Purpose**: Accelerate development by providing comprehensive knowledge about project structure, conventions, components, hooks, services, and backend architecture.

---

## 📦 Project Overview

**Inzerty** = Český Inzertní Scraper UI pro Bazoš Arbitráž

### Core Purpose
- Scrapování, ukládání a porovnávání inzerátů mobilních telefonů (nabídka vs. poptávka)
- Hledání **arbitrážních příležitostí** (koupit levněji, prodat dráže)
- Autonomní AI vyjednávání, fraud detection, a plánovač schůzek

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript + Vite |
| **Backend** | Node.js + Express + Axios + Cheerio |
| **Database** | SQLite (default) / PostgreSQL (optional) |
| **AI/ML** | Ollama (llama3.2:1b) + Google GenAI SDK |
| **Testing** | Vitest + React Testing Library |
| **Build Tools** | Vite, ESModules |

---

## 🗂️ Project Structure

### Frontend (`/`)

```
├── App.tsx                    # Main app root, view routing
├── index.tsx                  # React DOM render point
├── types.ts                   # Core TypeScript interfaces (Ad, ScraperConfig, etc.)
├── constants.ts/tsx           # App-wide constants
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite configuration
│
├── components/                # React components
│   ├── Header.tsx
│   ├── MonitoringDashboard.tsx
│   ├── FollowUpCalendar.tsx
│   ├── ConversationDashboard.tsx
│   ├── AutomationControls.tsx
│   ├── SettingsPage.tsx
│   ├── DealPipelineBoard.tsx
│   ├── DealStateTracker.tsx
│   ├── NegotiationInterface.tsx
│   ├── FraudDashboard.tsx
│   ├── AnalyticsCharts.tsx
│   ├── PriorityDashboard.tsx
│   ├── RealTimeNotifications.tsx
│   ├── ServerStatus.tsx
│   ├── SubComponent/           # Component folders with related files
│   │   ├── MatchCard/
│   │   ├── MatchFilters/
│   │   ├── MatchList/
│   │   ├── AlertsPanel/
│   │   ├── ExportPanel/
│   │   ├── Settings/
│   │   └── views/
│   └── useWebSocket.ts        # WebSocket hook (shared state)
│
├── hooks/                      # Custom React hooks
│   ├── useConfig.ts           # Config & app state management
│   ├── useScraping.ts         # Scraping & comparison logic
│   ├── useMatchFilters.ts     # Ad filtering & sorting
│   ├── usePriorityWeights.ts  # Priority calculation
│   ├── useFraudThresholds.ts  # Fraud detection thresholds
│   ├── useUserCapacity.ts     # User capacity limits
│   ├── usePriorityDashboard.ts
│   ├── useAnalytics.ts
│   ├── useAutomation.ts
│   ├── useBulkActions.ts
│   ├── useExport.ts           # CSV export
│   ├── useLogs.ts             # Runtime logs
│   ├── useOllama.ts           # Ollama AI integration
│   ├── useAlertsConfig.ts
│   ├── useSettingsForm.ts
│   └── usePreviouslySeen.ts
│
├── services/                   # API & business logic
│   ├── geminiService.ts       # Google Gemini AI integration
│   └── messageTemplates.ts    # Message template presets
│
├── utils/                      # Utility functions
│
└── dokumentace/               # Project documentation
    ├── 00_INDEX.md
    ├── 01_Faze_1_AI_Message_Generator.md
    ├── 02_Faze_2_Auto_FollowUp.md
    ├── 03_Faze_3_Fraud_Detection.md
    ├── ... (13+ detailed phase docs)
    └── 14_Detekce_Podvodu.md
```

### Backend (`/backend/src`)

```
├── index.ts                   # App entry point, server bootstrap
├── app.ts                     # Express app setup
├── database.ts                # Database connection & init
├── websocket.ts               # WebSocket server (real-time comms)
│
├── routes/                    # API endpoints
│   ├── ads.ts
│   ├── matches.ts
│   ├── scrapers.ts
│   ├── automation.ts
│   └── ...
│
├── controllers/               # Business logic for routes
│   ├── adController.ts
│   ├── matchController.ts
│   └── ...
│
├── services/                  # Core business services
│   ├── scrapingService.ts
│   ├── comparisonService.ts
│   ├── fraudDetectionService.ts
│   ├── negotiationService.ts
│   └── ...
│
├── scrapers/                  # Platform-specific scrapers
│   ├── bazosScraperCZ.ts
│   ├── bazosScraperSK.ts
│   ├── sbazarScraper.ts
│   ├── mobilnetScraper.ts
│   ├── aukroScraper.ts
│   ├── vintedScraper.ts
│   └── ...
│
├── database/                  # Database models & migrations
│   ├── schema.ts
│   ├── queries.ts
│   └── migrations/
│
├── utils/                     # Helper utilities
│   ├── validators.ts
│   ├── parsers.ts
│   ├── logger.ts
│   └── ...
│
├── index.d.ts                 # TypeScript build output
└── inzerty.db                 # SQLite database (default)
```

---

## 🧩 Key Types & Interfaces

All defined in types.ts file:

### `Ad` - Single Advertisement
```typescript
interface Ad {
  id: string;
  title: string;
  price: string;
  location: string;
  description: string;
  date_posted: string;
  url: string;
  image_url: string;
  ad_type: string;        // 'nabídka' | 'poptávka'
  brand: string;          // 'iPhone', 'Samsung', etc.
  scraped_at: string;
  views: string;
  is_top: boolean;
  similarity?: number;
  ai?: boolean;
  source: AdSource;       // Platform: 'bazos_cz' | 'sbazar' | etc.
  seller?: {
    name?: string;
    phone?: string;
    rating?: number;
    verified?: boolean;
  };
  metadata?: Record<string, any>;
}
```

### `ScraperResult` - Scraper Output
```typescript
interface ScraperResult {
  ads: Ad[];
  savedAdsCount: number;
  error?: string;
  warnings?: string[];
  metadata?: {
    scrapedAt: string;
    source: AdSource;
    pagesScraped: number;
    totalAdsFound: number;
  };
}
```

### `AdSource` - Supported Platforms
```typescript
type AdSource = 
  | 'bazos_cz' 
  | 'bazos_sk' 
  | 'sbazar' 
  | 'mobilnet' 
  | 'aukro' 
  | 'vinted' 
  | 'facebook_marketplace'
  | 'hyperinzerce'
  | 'annonce';
```

### `ScraperConfig` - Platform Configuration
```typescript
interface ScraperConfig {
  enabled: boolean;
  source: AdSource;
  baseUrl: string;
  categories: {
    nabidka: string[];      // Offer URLs
    poptavka: string[];     // Demand URLs
  };
  selectors: {
    adList: string;         // CSS selector for ad container
    adItem: string;
    title: string;
    price: string;
    link: string;
    description?: string;
    location?: string;
    date?: string;
    image?: string;
    seller?: string;
  };
  scrapingOptions: {
    delay: number;          // Delay between requests (ms)
    jitter: number;         // Random jitter
    maxPages: number;
    maxAdsPerType: number;
    stopOnKnownAd: boolean;
    userAgents: string[];
  };
}
```

---

## 🪝 Custom Hooks Reference

### Core State Management

#### `useConfig()`
- **Purpose**: App configuration, alerts, settings, database management
- **Returns**: 
  - `config`, `setConfig`
  - `alertsConfig`
  - `progress`, `setProgress`
  - `handleSaveSettings()`
  - `handleClearDatabase()`
- **Usage**: Global app settings, alerts configuration, progress tracking

#### `useScraping()`
- **Purpose**: Orchestrate scraping and ad comparison
- **Dependencies**: `config`, `setProgress`
- **Returns**:
  - `ads`, `setAds`
  - `matchedAds`, `setMatchedAds`
  - `isScraping`, `isComparing`
  - `scrapeSummary`, `setScrapeSummary`
  - `appState`, `setAppState`
  - `lastScrapeDuration`
  - `handleStartScraping()`
  - `handleStartComparison()`
  - `handleCompareStoredAds()`

#### `useOllama()`
- **Purpose**: Manage Ollama AI model state
- **Dependencies**: `setProgress`
- **Returns**:
  - `ollamaActive` - Is Ollama running?
  - `isTogglingOllama`
  - `toggleOllama()` - Start/stop Ollama

#### `useLogs()`
- **Purpose**: Runtime logs visualization
- **Returns**: `runtimeLogs`

### Feature-Specific Hooks

#### `useMatchFilters(ads)`
- Filter & sort ads by multiple criteria (price, priority, date, etc.)

#### `usePriorityWeights()`
- Manage priority scoring weights

#### `useFraudThresholds()`
- Fraud detection configuration

#### `useUserCapacity()`
- User capacity limits (simultaneous negotiations, etc.)

#### `useExport()`
- CSV export functionality

#### `useAnalytics()`
- Analytics & metrics tracking

#### `useAutomation()`
- Automation rules management

---

## 🔌 Services

### Frontend Services

#### `geminiService.ts`
- Google Gemini API integration
- AI message generation
- Sentiment analysis

#### `messageTemplates.ts`
- Pre-built message templates for buyers/sellers
- Quick message generation

### Backend Services
Located in `/backend/src/services/`:

- **scrapingService** - Multi-platform scraping orchestration
- **comparisonService** - Ad matching & similarity scoring (local vs. Ollama modes)
- **fraudDetectionService** - Fraud risk scoring (15+ detection signals)
- **negotiationService** - AI negotiation logic
- **notificationService** - Alerts (Telegram, Email, Discord)
- **exportService** - CSV/Excel export

---

## 🏗️ Components Architecture

### Layout & Navigation
- **Header** - Top navigation, branding
- **WorkflowSidebar** - Side navigation, view switcher

### Main Views
- **MonitoringDashboard** - Real-time monitoring (offers/demand data)
- **DealPipelineBoard** - Kanban board (Nové → Prověřit → Kontaktováno → Vyjednávání → Uzavřeno)
- **DealStateTracker** - Track individual deal progress
- **FollowUpCalendar** - Schedule & manage follow-ups
- **ConversationDashboard** - Message history & automation
- **SettingsPage** - Configuration & preferences

### Dashboard & Analytics
- **PriorityDashboard** - Priority scoring & filtering
- **AnalyticsCharts** - Statistics & trends
- **RealTimeNotifications** - Alert display
- **FraudDashboard** - Fraud detection metrics

### Automation & Intelligence
- **AutomationControls** - Toggle automation rules
- **NegotiationInterface** - AI negotiation UI
- **MeetingScheduler** - Meeting planning
- **AutoPrioritizationPanel** - Auto-priority settings
- **FraudAnalyzer** - Detailed fraud analysis

### Sub-Components
- **MatchCard/** - Individual ad card component
- **MatchFilters/** - Advanced filtering UI
- **MatchList/** - List of matched ads
- **AlertsPanel/** - Alert management
- **ExportPanel/** - Export options
- **Settings/** - Settings sub-pages

---

## 🔄 App View Routing

```typescript
type AppView = 'dashboard' | 'calendar' | 'settings' | 'conversations' | 'automation';
```

Set via `setView()` in App.tsx, controls which component is displayed.

---

## 📡 Backend API Routes

Base URL: `http://localhost:3001`

### Ads & Matches
- `GET /api/ads` - List all ads
- `GET /api/ads/:id` - Get single ad
- `GET /api/matches` - List matched ads
- `GET /matches/export` - Export matches as JSON

### Scraping
- `POST /api/scrapers/start` - Start scraping
- `GET /api/scrapers/status` - Get scraper status
- `POST /api/scrapers/compare` - Compare stored ads

### Comparison
- `POST /api/comparison/analyze` - AI-powered analysis

### Automation
- `POST /api/automation/start`
- `POST /api/automation/stop`

### WebSocket (Real-time)
- Connection: `ws://localhost:3001`
- Events: `scraping_progress`, `comparison_progress`, `match_found`, `error`

---

## 🗄️ Database Schema

### Primary Tables
- **ads** - All scraped advertisements
- **matches** - Matched ad pairs (offer + demand)
- **conversations** - Negotiation messages
- **deal_tracking** - Deal pipeline state
- **fraud_scores** - Fraud detection results
- **settings** - User configuration

### Default Database
- **SQLite**: `inzerty.db` (file-based, zero-config)
- **PostgreSQL** (optional): Set `DB_CLIENT=postgres` + `DATABASE_URL` env var

---

## 🛠️ Scripts & Commands

### Frontend
```bash
npm run dev              # Start Vite dev server (http://localhost:5173)
npm run build            # Build for production
npm run preview          # Preview production build
npm run test             # Run vitest
npm run test:coverage    # Generate coverage report
```

### Backend
```bash
npm run dev              # Start backend with tsx watch (http://localhost:3001)
npm run start            # Start production backend
npm run test             # Run vitest
npm run test:watch       # Watch mode testing
npm run test:coverage    # Coverage report
npm run test:integration # Integration tests
```

### Full Stack
```bash
./start-vse.sh          # Start frontend + backend + database
./stop.sh               # Stop all services
```

---

## 📝 Coding Conventions

### Component Files
- **Naming**: PascalCase (e.g., `MonitoringDashboard.tsx`)
- **Location**: `/components` or `/components/SubFeature/`
- **Exports**: Default export is the component
- **Props**: Define interface `interface ComponentProps { ... }`

### Hook Files
- **Naming**: camelCase with `use` prefix (e.g., `useConfig.ts`)
- **Location**: `/hooks`
- **Returns**: Object with state, handlers, and dependencies
- **Pattern**: Custom state management, external API calls, subscriptions

### Service Files
- **Naming**: camelCase with `Service` suffix (e.g., `geminiService.ts`)
- **Location**: `/services`
- **Pattern**: Singleton-like, pure functions or static methods
- **Purpose**: Third-party API integration, business logic

### Types & Interfaces
- **Location**: types.ts
- **Naming**: PascalCase (e.g., `Ad`, `ScraperConfig`)
- **Convention**: Comprehensive, well-documented interfaces
- **Exports**: Named exports

### Styling
- **Framework**: Tailwind CSS (utility-first)
- **Approach**: Inline `className` attributes
- **BEM or Modules**: Not used (Tailwind handles styling)

### Testing
- **Framework**: Vitest + React Testing Library
- **File naming**: `*.test.ts` or `*.test.tsx`
- **Location**: Same folder as component/hook
- **Pattern**: Unit tests, component rendering tests

---

## 🎯 Development Workflow

1. **New Feature**:
   - Create component in `/components`
   - If complex state → custom hook in `/hooks`
   - If API call → service in `/services`
   - Add tests (`*.test.tsx`)

2. **Bug Fix**:
   - Find failing test or reproduce
   - Fix in component/hook/service
   - Add regression test
   - Test build

3. **Refactoring**:
   - Preserve types
   - Run test suite
   - Check WebSocket connectivity
   - Verify Ollama integration if modified

4. **Database Changes**:
   - SQLite: Modify schema in `/backend/src/database/schema.ts`
   - PostgreSQL: Create migration in `/backend/src/database/migrations/`
   - Update types if needed
   - Test with both DB clients

---

## 🚀 Key Features to Know

### Multi-Platform Scraping
- Supports 9+ platforms (Bazoš.cz, Sbazar, Mobilnet, Aukro, Vinted, etc.)
- Incremental scraping with checkpoints
- User-Agent rotation & proxy support
- Retry logic with exponential backoff

### AI Integration
- **Ollama** (local): llama3.2:1b for embeddings & comparison
- **Google Gemini**: Message generation & sentiment analysis
- **Auto mode**: Fallback to local comparison if Ollama unavailable

### Fraud Detection
- 15+ detection signals (price anomalies, seller reputation, etc.)
- Risk scoring & watchlist management
- Automated alerts

### Negotiation Automation
- AI sentiment analysis
- Optimal counter-offer generation
- Market-aware pricing

### Follow-up & Scheduling
- Automated reminder system
- Calendar integration (iCal export)
- Meeting place suggestions (Google Places)

---

## 📚 Documentation Phases

Full development roadmap in `/dokumentace/`:
1. AI Message Generator
2. Auto Follow-Up
3. Fraud Detection
4. UI Automation
5. Priority Thresholds
... and 9+ more phases

---

## 🔍 Where to Look

| Task | File/Folder |
|------|-------------|
| Add new component | `/components` |
| Add custom hook | `/hooks` |
| Add API service | `/services` |
| Modify types | `types.ts` |
| Backend routing | `/backend/src/routes` |
| Scraping logic | `/backend/src/services/scrapingService.ts` |
| Fraud detection | `/backend/src/services/fraudDetectionService.ts` |
| Database query | `/backend/src/database` |
| Styling | Tailwind classes in component JSX |
| Testing | `*.test.ts` near source files |
| Configuration | `constants.ts`, `/backend/src/database.ts` |

---

## 🤝 Integration Points

- **Frontend ↔ Backend**: REST API + WebSocket
- **Backend ↔ Database**: SQLite/PostgreSQL (ORM: custom queries)
- **Backend ↔ AI**: Ollama (local) + Google Gemini (cloud)
- **Notifications**: Telegram, Email, Discord webhooks
- **Auth**: Currently not implemented (dev mode)

---

**Last Updated**: March 26, 2026  
**Version**: 1.0
