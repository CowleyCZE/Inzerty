# Automatický Skript pro Skenování Neúplných Funkcí

Tento adresář obsahuje komplexní systém pro automatické hledání, analýzu a generování implementací neúplných funkcí v workspace.

## 📦 Obsah

- **SKILL.md** - Definice skill pro AI agenta (skenování)
- **generate-implementation-skill.md** - Definice skill pro generování šablon
- **scan-incomplete.js** - Node.js skript pro automatické skenování
- **generate-implementation.js** - Generátor šablon a HTML reportu
- **README.md** - Tato dokumentace

## 🚀 Instalace a Spuštění

### Rychlý Start: Kompletní Audit

```bash
# 1. Skenovat všechny neúplné funkce a vygenerovat šablony
npm run audit:incomplete

# 2. Vygenerovat HTML report
npm run gen:templates:html

# 3. Otevřít report v prohlížeči
open incomplete-report.html  # macOS
xdg-open incomplete-report.html  # Linux
```

### Spuštění jednotlivých příkazů

#### Skenování

```bash
# Skenovat všech neúplných funkcí
npm run scan:incomplete

# Skenovat jen konkrétní složku
node .github/skills/find-incomplete-functions/scan-incomplete.js ./src
node .github/skills/find-incomplete-functions/scan-incomplete.js ./backend

# Výstup jako JSON (bez logů)
node .github/skills/find-incomplete-functions/scan-incomplete.js . --json
```

#### Generování Šablon

```bash
# Skenovat + vygenerovat šablony (terminal output)
npm run scan:incomplete:json > incomplete.json && \
node .github/skills/find-incomplete-functions/generate-implementation.js incomplete.json

# Skenovat + vygenerovat HTML report
npm run gen:templates:html

# Manuální generování z JSON souboru
node .github/skills/find-incomplete-functions/generate-implementation.js incomplete.json --html report.html
```

## 🔍 Co Skript Hledá

Skript automaticky detekuje tyto vzorce neúplných implementací:

### 1. **TODO/FIXME Komentáře** (severity: medium/high)
```typescript
const getUserData = () => {
  // TODO: implementovat autentifikaci
  return null;
};

const processPayment = () => {
  // FIXME: chyba v kalkulaci daně
  return 0;
};
```

### 2. **Error Stub Funkce** (severity: high)
```typescript
function validateEmail() {
  throw new Error("not implemented");
}

const calculate = () => {
  throw new Error("stub");
};
```

### 3. **Markerů Nedokončenosti** (severity: medium)
```typescript
// stub - bude se implementovat
function processData() { }

// placeholder - dočasné řešení
const getTempData = () => null;

// WIP - rozpracované
function newFeature() { }
```

### 4. **NotImplementedError Výjimky** (severity: high)
```python
def analyze_data():
    raise NotImplementedError()
```

## 🔧 Generování Implementačních Šablon

Po skenování můžeš automaticky generovat šablony pro implementaci:

### Typy Detekovaných Šablon

#### 1. **Async Functions**
```typescript
async function fetchData() {
  try {
    // 🔧 TODO: Implementovat logiku
    const result = await Promise.resolve(null);
    return result;
  } catch (error) {
    console.error(`Chyba v fetchData:`, error);
    throw error;
  }
}
```

#### 2. **Validation Functions**
```typescript
function validateValue(value: any): boolean {
  // 🔧 TODO: Implementovat validaci
  if (!value) return false;
  return true;
}
```

#### 3. **API Handlers**
```typescript
export async function handleRequest(req, res) {
  try {
    const result = await someService.process(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
```

#### 4. **React Component Handlers**
```typescript
const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const value = event.target.value;
  // 🔧 TODO: Implementovat handler
};
```

#### 5. **Service Methods**
```typescript
public process(config): Result {
  try {
    // 1. Validovat vstupy
    // 2. Provést operaci  
    // 3. Vrátit výsledek
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### HTML Report

Generátor vytváří interaktivní HTML report s:
- 📊 Statistikou (počty šablon, priorita)
- 🎨 Barevným zvýrazněním podle priority
- 💻 Formátkváním syntaxe
- 📄 Tiskitelným formátem
- ✔️ Offline dostupností

Příklad:
```bash
npm run gen:templates:html
```

Vytvoří: `incomplete-report.html` (5-10 KB na disku)

## 📊 Výstup Skriptu

### Běžný Formát (barevný výstup do terminálu)

```
🔍 Skenování: /home/cowley/Dokumenty/projekty/Inzerty

📋 Nalezeno 12 neúplných položek

📄 src/components/NegotiationInterface.tsx
  📌 Řádek 45: [TODO/FIXME]
     // TODO: Dokončit základní logiku vyjednávání
  ⚠️ Řádek 89: [Error Stub]
     throw new Error("not implemented");

📄 backend/src/services/fraudDetection.ts
  ⚠️ Řádek 156: [NotImplemented]
     raise NotImplementedError()
  📌 Řádek 203: [Stub Marker]
     // stub: prozatím vrací dummy data

✨ Skenování hotovo!
```

### JSON Formát

```bash
node scan-incomplete.js . --json
```

Výstup:
```json
{
  "src/components/NegotiationInterface.tsx": [
    {
      "type": "TODO/FIXME",
      "line": 45,
      "match": "// TODO: Dokončit logiku",
      "severity": "medium",
      "context": "const handleNegotiate = () => {"
    }
  ]
}
```

## 🛠️ Příklady Použití

### Skenování celého projektu
```bash
node .github/skills/find-incomplete-functions/scan-incomplete.js
```

### Skenování frontend komponenty
```bash
node .github/skills/find-incomplete-functions/scan-incomplete.js ./components
```

### Skenování backend služeb
```bash
node .github/skills/find-incomplete-functions/scan-incomplete.js ./backend/src
```

### Export do souboru pro další zpracování
```bash
node .github/skills/find-incomplete-functions/scan-incomplete.js . --json > report.json
```

## 🎯 Priorty Výsledků

Skript přiřazuje prioritu podle typu:

| Typ | Priorita | Symbol |
|-----|----------|--------|
| Error Stub | 🔴 Vysoká | ⚠️ |
| NotImplemented | 🔴 Vysoká | ⚠️ |
| FIXME | 🟡 Střední | 📌 |
| TODO | 🟡 Střední | 📌 |
| Stub Marker | 🟡 Střední | 📌 |

## 📁 Podporované Soubory

Standardně skript skenuje:
- TypeScript (`.ts`, `.tsx`)
- JavaScript (`.js`, `.jsx`)
- Python (`.py`)
- Java (`.java`)
- Go (`.go`)
- Rust (`.rs`)

### Vyloučené Adresáře (automaticky přeskočeny)

```
node_modules/
dist/
build/
.git/
.next/
coverage/
vendor/
```

## 🔧 Automatizace

### Přidání do package.json

```json
{
  "scripts": {
    "scan:incomplete": "node .github/skills/find-incomplete-functions/scan-incomplete.js .",
    "scan:incomplete:json": "node .github/skills/find-incomplete-functions/scan-incomplete.js . --json",
    "scan:components": "node .github/skills/find-incomplete-functions/scan-incomplete.js ./components",
    "scan:backend": "node .github/skills/find-incomplete-functions/scan-incomplete.js ./backend",
    "gen:templates": "node .github/skills/find-incomplete-functions/generate-implementation.js",
    "gen:templates:html": "npm run scan:incomplete:json -- > /tmp/incomplete.json && node .github/skills/find-incomplete-functions/generate-implementation.js /tmp/incomplete.json --html incomplete-report.html",
    "audit:incomplete": "npm run scan:incomplete && npm run gen:templates:html"
  }
}
```

### Použití

```bash
# Skenovat workspace
npm run scan:incomplete

# Skenovat a vygenerovat HTML
npm run gen:templates:html

# Kompletní audit (skenovat + generovat HTML)
npm run audit:incomplete

# Skenovat konkrétní složku
npm run scan:backend
npm run scan:components
```

### Integrala do pre-commit Hook

Přidat do `.git/hooks/pre-commit`:
```bash
#!/bin/bash
node .github/skills/find-incomplete-functions/scan-incomplete.js .
if [ $? -ne 0 ]; then
  echo "⚠️ Zjištěny neúplné funkce - prosím přezkontrolujte!"
fi
```

## 🎨 Barvy Výstupu

Skript používá následující barevné kódování:

- 🔵 **Blue** - Název souboru
- 🔴 **Red** - Vysoká priorita (Error, NotImplemented)
- 🟡 **Yellow** - Běžná priorita (TODO, FIXME, Stub)
- 🟢 **Green** - Potvrzení dokončení
- ⚫ **Dim** - Kontextový kód

## 📝 Kombinování s AI Skill

Po spuštění skriptu můžete jeho výstup předat AI agentovi:

```bash
# Spustit skript a jeho výstup předat agentovi
node .github/skills/find-incomplete-functions/scan-incomplete.js ./components --json
```

Pak v chatu: *"Jsem našel tyto neúplné funkce [vlepení JSON]. Který máš na vytvoření implementace?"*

## 🚀 Tipy a Triky

1. **Regulární aktualizace**: Spuste skript týdně, abyste sledoval pokrok
2. **Export pro tracking**: Využívejte `--json` pro integraci s task trackerem
3. **Specifické hledání**: Kombinujte se `grep` pro detailnější filtrování:
   ```bash
   node .github/skills/find-incomplete-functions/scan-incomplete.js . --json | grep "FIXME"
   ```
4. **Porovnání v čase**: Uložte si staré výstupy a porovnávejte pokrok

## 🐛 Řešení Problémů

### Skript se nespustí

Ujistěte se, že máte nainstalován Node.js:
```bash
node --version
```

### Příliš mnoho falešných pozitivů

Upravte `config.patterns` v souboru `scan-incomplete.js` a odstraňte vzorce, které nejsou relevantní.

### Skenování trvá příliš dlouho

Přidejte více adresářů do `excludeDirs` nebo skenujte konkrétní složky:
```bash
node scan-incomplete.js ./src/components
```
