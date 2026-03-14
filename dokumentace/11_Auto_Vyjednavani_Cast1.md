# 🔄 Auto Negotiation - Část 1: Nastavení a Stats

## 📋 Přehled implementace

**Datum**: 2026-03-12  
**Status**: 🔄 Část 1 dokončena (nastavení + endpointy)

---

## 🎯 Cíl

Vytvořit systém pro automatické vyjednávání cen s prodejci na základě AI analýzy.

---

## ✅ Dokončené funkce (Část 1)

### 1. **UI AutoNegotiationSettings**

#### Stats Overview (4 karty)
- **Celkem vyjednávání**: Total negotiations count
- **Úspěšných**: Successful negotiations count
- **Průměrná úspora**: Average savings per negotiation
- **Průměrně kol**: Average negotiation rounds per deal

#### Nastavení (6 položek)
1. **Minimální zisk (Kč)**
   - Default: 1000 Kč
   - Minimální zisk po odkoupení

2. **Max sleva z poptávky (%)**
   - Default: 30%
   - Maximální sleva z poptávkové ceny

3. **Auto-přijmout do (Kč)**
   - Default: 5000 Kč
   - Automaticky přijmout pokud counter ≤ této částky

4. **Max kol vyjednávání**
   - Default: 3
   - Maximální počet kol na jeden match

5. **Vyžadovat manuální schválení finální nabídky**
   - Default: true
   - Toggle pro poslední kolo vyjednávání

6. **Toggle enabled/disabled**
   - Hlavní přepínač pro celý systém

---

### 2. **Backend Endpointy**

#### `GET /negotiation/settings`
Načte aktuální nastavení.

**Response**:
```json
{
  "success": true,
  "settings": {
    "enabled": false,
    "minProfit": 1000,
    "maxDiscountPercent": 30,
    "autoAcceptThreshold": 5000,
    "maxAutoNegotiations": 3,
    "requireManualFinal": true
  }
}
```

#### `POST /negotiation/settings`
Uloží nová nastavení.

**Request**:
```json
{
  "enabled": true,
  "minProfit": 1500,
  "maxDiscountPercent": 25,
  ...
}
```

**Response**:
```json
{
  "success": true,
  "message": "Settings saved",
  "settings": { ... }
}
```

#### `GET /negotiation/stats`
Načte statistiky vyjednávání.

**Response**:
```json
{
  "success": true,
  "stats": {
    "totalNegotiations": 0,
    "successfulNegotiations": 0,
    "avgSavings": 0,
    "avgNegotiationRounds": 0
  }
}
```

---

### 3. **Integrace do Automation Controls**

#### Nový tab "💰 Vyjednávání"
- Umístění: mezi Analytics a Nastavení
- Obsahuje AutoNegotiationSettings komponentu
- Barevné rozlišení: purple header

---

## 📊 Statistiky implementace

| Soubor | Změny | Řádky |
|--------|-------|-------|
| `components/AutoNegotiationSettings.tsx` | Nová komponenta | ~230 řádků |
| `components/AutomationControls.tsx` | Integrace + nový tab | +30 řádků |
| `backend/src/index.ts` | 3 nové endpointy | +80 řádků |
| `todo.md` | Aktualizace | - |
| `CHANGELOG.md` | Dokumentace | +20 řádků |

**Celkem**: ~360 nových řádků kódu

---

## 🔄 Co přijde v Část 2

### Auto-Counteroffer System
1. **Message Analyzer**
   - Detekce counter-offer ve zprávě
   - Extrakce ceny z textu
   - Analýza sentimentu

2. **Decision Engine**
   - Accept/Reject/Counter logika
   - AI generování proti-nabídek
   - Ukládání historie

3. **Auto-Send Messages**
   - Automatické odesílání counter-offers
   - Rate limiting
   - Fallback na manuální schválení

---

## 🎮 Jak používat

### Nastavení Auto Negotiation
```
1. Otevřít aplikaci → http://localhost:5173
2. Kliknout na "🤖 Automation"
3. Kliknout na "💰 Vyjednávání" tab
4. Nastavit parametry:
   - Minimální zisk: 1000 Kč
   - Max sleva: 30%
   - Auto-přijmout do: 5000 Kč
   - Max kol: 3
   - Manuální schválení: Zapnuto
5. Přepnout toggle na "enabled"
6. Kliknout "Uložit nastavení"
```

### Sledování statistik
```
1. Automation → Vyjednávání tab
2. Horní část ukazuje 4 karty:
   - Celkem vyjednávání
   - Úspěšných
   - Průměrná úspora
   - Průměrně kol
```

---

## ⚠️ Důležité poznámky

### 1. Nastavení
- Currently in-memory (při restartu se ztratí)
- Production: uložit do databáze

### 2. Stats
- Currently mock data (vrací 0)
- Production: query negotiation_history tabulku

### 3. Bezpečnost
- Min profit chrání před ztrátovými obchody
- Max discount limituje příliš nízké nabídky
- Manuální schválení pro finální nabídky je doporučené

---

## 📈 Metriky úspěšnosti (Část 1)

| Metrika | Cíl | Status |
|---------|-----|--------|
| UI komponenta | ✅ Full settings form | ✅ |
| Stats overview | ✅ 4 karty | ✅ |
| Backend endpointy | ✅ 3 endpointy | ✅ |
| Integrace | ✅ Automation tab | ✅ |
| Toggle controls | ✅ Enabled/disabled | ✅ |

---

## 📝 Závěr

**Část 1 úspěšně dokončena!** ✅

Všechny cíle Část 1 splněny:
- ✅ UI pro nastavení auto negotiation
- ✅ Stats overview komponenta
- ✅ Backend endpointy (settings, stats)
- ✅ Integrace do Automation Controls

**Část 2**: Implementace auto-counteroffer systému.

---

*Dokument vytvořen: 2026-03-12*  
*Autor: Autonomní Lead Fullstack Developer*
