# TODO.md — Seznam úkolů pro Bazoš Arbitráž

## 🔄 Aktuální úkoly

### Právě pracuji
| Úkol | Popis | Priorita | Stav |
|------|-------|----------|------|
| **Oprava chyb** | Oprava "different vector dimensions 384 and 2048" | Kritická | ✅ **Dokončeno** |

## 📋 Stav implementace funkcí

### ✅ Dokončené funkce

| Funkce | Stav | Datum dokončení |
|--------|------|-----------------|
| **🌍 Multi-Platform Scraping - Fáze 1** | ✅ **Hotovo** | 2026-03-16 |
| - AdSource typy pro všechny platformy | ✅ Hotovo | 2026-03-16 |
| - Rozšířený Ad interface (source, seller, metadata) | ✅ Hotovo | 2026-03-16 |
| - BaseScraper abstraktní třída | ✅ Hotovo | 2026-03-16 |
| - BaseScraper.updateConfig() a getConfig() metody | ✅ Hotovo | 2026-03-30 |
| - BazosCZScraper reference implementace | ✅ Hotovo | 2026-03-16 |
| - ScraperFactory pattern s aktualizací konfigurace | ✅ Hotovo | 2026-03-30 |
| - Databázové sloupce pro multi-platform | ✅ Hotovo | 2026-03-16 |
| - UI PlatformSelector komponenta | ✅ Hotovo | 2026-03-16 |
| **🚀 Autonomous Process - One-Click Automation** | ✅ **Hotovo** | 2026-03-16 |
| - Endpoint /automation/run-all | ✅ Hotovo | 2026-03-16 |
| - 6 autonomních kroků (fraud, priority, state, follow-up, analytics, meeting) | ✅ Hotovo | 2026-03-16 |
| - Fallback pro AI nedostupnost | ✅ Hotovo | 2026-03-16 |
| - UI tlačítko s progress feedbackem | ✅ Hotovo | 2026-03-16 |
| Inkrementální scraping s checkpointy | ✅ Hotovo | - |
| Rotace User-Agent + retry logika | ✅ Hotovo | - |
| Porovnávání inzerátů (AI/Keyword/Auto) | ✅ Hotovo | - |
| Arbitrážní skóre | ✅ Hotovo | - |
| SQLite/PostgreSQL hybrid | ✅ Hotovo | - |
| **Akční fronta (Kanban) + metadata** | ✅ **Hotovo** | 2026-03-11 |
| - Status pipeline (Nové → Prověřit → Kontaktováno → Vyjednávání → Uzavřeno) | ✅ Hotovo | 2026-03-11 |
| - Priorita (Nízká/Střední/Vysoká/Kritická) | ✅ Hotovo | 2026-03-11 |
| - Poznámky | ✅ Hotovo | 2026-03-11 |
| - lastActionAt timestamp | ✅ Hotovo | 2026-03-11 |
| - Follow-up reminder | ✅ Hotovo | 2026-03-11 |
| - Due diligence checklist | ✅ Hotovo | 2026-03-11 |
| - **Šablony zpráv (Bazoš/SMS/E-mail)** | ✅ **Hotovo** | 2026-03-11 |
| - Export CSV | ✅ Hotovo | 2026-03-11 |
| - Denní report | ✅ Hotovo | 2026-03-11 |
| - **Alerty (Telegram/Email/Discord)** | ✅ **Hotovo** | 2026-03-11 |
| **Skóre reálné příležitosti** | ✅ **Hotovo** | 2026-03-11 |
| - 6 vážených komponent (zisk, podobnost, marže, stáří, lokalita, důvěryhodnost) | ✅ Hotovo | 2026-03-11 |
| - Tooltip s detailním breakdownem | ✅ Hotovo | 2026-03-11 |
| **Blacklist / whitelist pravidla** | ✅ **Hotovo** | 2026-03-11 |
| - UI pro správu blacklist výrazů (tagy, validace, nápověda) | ✅ Hotovo | 2026-03-11 |
| - UI pro správu whitelist modelů (tagy, validace, nápověda) | ✅ Hotovo | 2026-03-11 |
| - Cenové filtry a filtry úložiště | ✅ Hotovo | 2026-03-11 |
| **Deduplikace mezi běhy** | ✅ **Hotovo** | 2026-03-11 |
| - Automatické ukládání zobrazených zápasů | ✅ Hotovo | 2026-03-11 |
| - Filtr "skrýt dříve zobrazené" | ✅ Hotovo | 2026-03-11 |
| - Hromadné akce (bulk actions) | ✅ Hotovo | 2026-03-11 |
| - Výběr zápasů checkboxy | ✅ Hotovo | 2026-03-11 |
| **Export CSV/Google Sheets** | ✅ **Hotovo** | 2026-03-11 |
| - Rozšířený CSV export (19 sloupců) | ✅ Hotovo | 2026-03-11 |
| - Google Sheets API integrace | ✅ Hotovo | 2026-03-11 |
| - Google Apps Script webhook | ✅ Hotovo | 2026-03-11 |
| - UI pro nastavení exportu | ✅ Hotovo | 2026-03-11 |
| **Kalendář/Reminder pro follow-up** | ✅ **Hotovo** | 2026-03-11 |
| - Souhrnné karty (prošlé/dnes/zítra/týden) | ✅ Hotovo | 2026-03-11 |
| - Filtrování podle období | ✅ Hotovo | 2026-03-11 |
| - Odesílání reminderů (Telegram/Email) | ✅ Hotovo | 2026-03-11 |
| - Barevné rozlišení stavů a priorit | ✅ Hotovo | 2026-03-11 |
| **Due Diligence Checklist** | ✅ **Hotovo** | 2026-03-11 |
| - 5 kontrolních položek s ikonami | ✅ Hotovo | 2026-03-11 |
| - Progress bar a statistiky | ✅ Hotovo | 2026-03-11 |
| - Barevné rozlišení splněno/nesplněno | ✅ Hotovo | 2026-03-11 |
| - Interaktivní boxy s hover efekty | ✅ Hotovo | 2026-03-11 |

### 🔄 Rozpracované

| Funkce | Popis | Priorita | Stav |
|--------|-------|----------|------|
| **AI autonomní komunikace** | Generování zpráv pomocí AI | Vysoká | ✅ **Dokončeno** |
| **AI automatizace - Fáze 2** | Auto follow-up, state machine | Vysoká | ✅ **Dokončeno** |
| **AI automatizace - Fáze 3** | Fraud detection, negotiation, analytics | Vysoká | ✅ **Dokončeno** |
| **AI automatizace - Fáze 4** | UI pro automation controls | Střední | ✅ **Dokončeno** |
| **Auto Negotiation** | Automatické vyjednávání cen | Vysoká | ✅ **Dokončeno** |
| **AI Priority Scoring** | AI rozhodování o prioritách | Vysoká | ✅ **Dokončeno** |
| **Meeting Scheduler** | Automatizované plánování předání | Vysoká | ✅ **Dokončeno** |
| **Enhanced Fraud Detection** | Rozšířená detekce podvodů | Vysoká | ✅ **Dokončeno** |
| **Deal State Tracking** | Automatické sledování stavu obchodu | Vysoká | ✅ **Dokončeno** |
| **Email Notifications** | Email notifikace a šablony | Vysoká | ✅ **Dokončeno** |
| **Calendar Integration** | Export do Google Calendar/iCal | Vysoká | ✅ **Dokončeno** |
| **Database Storage** | Perzistentní ukládání analýz | Vysoká | ✅ **Dokončeno** |

### 📝 Plánované

| Funkce | Popis | Priorita |
|--------|-------|----------|
| **Multi-Platform Scraping - Fáze 2** | Implementace Bazoš.sk scraperu | Vysoká |
| **Multi-Platform Scraping - Fáze 3** | Implementace Sbazar.cz scraperu | Vysoká |
| **Multi-Platform Scraping - Fáze 4** | Implementace Mobilnet.cz scraperu | Střední |
| **Multi-Platform Scraping - Fáze 5** | Implementace Aukro.cz (přes API) | Střední |
| **Cross-platform matching** | Porovnávání inzerátů mezi platformami | Vysoká |
| **Unified scraping process** | Spojení všech scraperů do jednoho procesu | Vysoká |
| Vylepšený Kanban view | Board view s drag & drop kartami | Nízká |
| Historie změn | Logování všech změn v match_meta | Střední |
| Vlastní šablony zpráv | UI pro ukládání vlastních šablon | Nízká |
| Automatické alerty po scrapingu | Auto-send po dokončení scrapingu | Nízká |
| Export blacklist/whitelist | Sdílení konfigurace mezi instancemi | Nízká |

---

## 🐛 Známé problémy

| Problém | Dopad | Priorita opravy |
|---------|-------|-----------------|
| Žádné známé problémy | - | - |

---

## 📅 Poslední aktualizace

- **2026-03-30**: Přidány metody updateConfig() a getConfig() do BaseScraper, vylepšen ScraperFactory pattern 🔧
- **2026-03-11**: Všechny požadované funkce (9/9) kompletně implementovány! 🎉
- **2026-03-11**: Vylepšen Due Diligence Checklist s progress barem a interaktivními boxy
- **2026-03-11**: Implementován kalendář/reminder pro follow-upy s notifikacemi
- **2026-03-11**: Implementován export CSV/Google Sheets s UI konfigurací
- **2026-03-11**: Implementována deduplikace mezi běhy s automatickým ukládáním a hromadnými akcemi
- **2026-03-11**: Implementováno pokročilé UI pro blacklist/whitelist s tagy a validací
- **2026-03-11**: Rozšířeny alerty o HTML emaily, Discord embeds a UI konfiguraci
- **2026-03-11**: Rozšířeny šablony zpráv o 6 variant (Bazoš/SMS/E-mail pro prodávající i kupující)
- **2026-03-11**: Dokončena implementace Kanban workflow s plnými metadaty
