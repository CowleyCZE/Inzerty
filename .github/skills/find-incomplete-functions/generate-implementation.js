#!/usr/bin/env node

/**
 * Generátor implementačních šablon pro neúplné funkce
 * Vezme scan-incomplete výstup a vytvoří code templates
 * 
 * Použití: 
 *   node generate-implementation.js <cesta-k-json>
 *   node generate-implementation.js --analyze <soubor.ts>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🎨 Barvy
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(text, color = 'reset') {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

// Šablony implementace podle typu
const templates = {
  async_function: (name) => `async function ${name}() {
  try {
    // 🔧 TODO: Implementovat logiku
    const result = await Promise.resolve(null);
    return result;
  } catch (error) {
    console.error(\`Chyba v \${name}:\`, error);
    throw error;
  }
}`,

  sync_function: (name) => `function ${name}() {
  // 🔧 TODO: Implementovat logiku
  return null;
}`,

  service_method: (name, params = 'config') => `public ${name}(${params}): Result {
  // 🔧 TODO: Implementovat obchodní logiku
  try {
    // 1. Validovat vstupy
    // 2. Provést operaci
    // 3. Vrátit výsledek
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}`,

  validation_function: (name) => `function ${name}(value: any): boolean {
  // 🔧 TODO: Implementovat validaci
  if (!value) return false;
  
  // Přidat specifické kontroly
  return true;
}`,

  api_handler: (name, method = 'GET') => `export async function ${name}(req, res) {
  try {
    // ${method} /api/...
    // 🔧 TODO: Implementovat handler
    
    const result = await someService.process(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}`,

  component_handler: (name) => `const ${name} = (event: React.ChangeEvent<HTMLInputElement>) => {
  // 🔧 TODO: Implementovat handler
  const value = event.target.value;
  console.log(value);
  
  // setState, callback, validation, etc.
};`,

  error_stub_fix: () => `// ⚠️ OPRAVIT: Nahradit placeholderem skutečná implementace
// Místo: throw new Error("not implemented");

// Správná implementace:
const result = await actualFunction();
return result;`,

  todo_comment: (comment) => `// 📝 TODO: ${comment}
// 
// Implementační kroky:
// 1. 🔍 Analyzovat requirements
// 2. 🛠️ Napsat kód
// 3. ✅ Otestovat
// 4. 📚 Aktualizovat dokumentaci`,
};

/**
 * Analyzuje funkci a vygeneruje vhodnou šablonu
 */
function analyzeFunction(fileContent, lineNum, match) {
  const lines = fileContent.split('\n');
  const context = lines.slice(Math.max(0, lineNum - 5), Math.min(lines.length, lineNum + 10)).join('\n');

  // Detekce typu funkce
  let type = 'sync_function';
  
  if (context.includes('async')) type = 'async_function';
  if (context.includes('validate') || context.includes('is')) type = 'validation_function';
  if (context.includes('handler') || context.includes('Handler')) type = 'component_handler';
  if (context.includes('api') || context.includes('API')) type = 'api_handler';
  if (context.includes('service') || context.includes('Service')) type = 'service_method';

  return { type, context };
}

/**
 * Vygeneruje template pro neúplnou funkci
 */
function generateTemplate(type, functionName) {
  const generator = templates[type] || templates.sync_function;
  
  if (typeof generator === 'function') {
    return generator(functionName);
  }
  return '';
}

/**
 * Zpracuje JSON výstup ze scan-incomplete.js
 */
function processIncompleteReport(jsonPath) {
  let report;
  
  try {
    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
    report = JSON.parse(jsonContent);
  } catch (err) {
    log(`❌ Chyba při čtení JSON: ${err.message}`, 'red');
    return;
  }

  const implementations = [];
  const cwd = process.cwd(); // Aktuální pracovní adresář

  Object.entries(report).forEach(([filePath, issues]) => {
    const fullPath = path.join(cwd, filePath); // Použít cwd, ne baseDir
    
    try {
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      
      issues.forEach((issue) => {
        // Extrahuj název funkce ze kontextu
        const funcNameMatch = issue.context.match(/(?:function|const|let|async)\s+(\w+)/);
        const functionName = funcNameMatch ? funcNameMatch[1] : 'unknownFunction';

        const analysis = analyzeFunction(fileContent, issue.line, issue.match);
        const template = generateTemplate(analysis.type, functionName);

        implementations.push({
          file: filePath,
          line: issue.line,
          type: issue.type,
          functionName,
          analysisType: analysis.type,
          severity: issue.severity,
          template,
          context: issue.context,
        });
      });
    } catch (err) {
      // File read error - skip
    }
  });

  return implementations;
}

/**
 * Vygeneruje report s šablonami
 */
function generateReport(implementations) {
  log('\n🔧 GENERÁTOR IMPLEMENTAČNÍCH ŠABLON\n', 'cyan');
  log(`📋 Nalezeno ${implementations.length} šablon k vygenerování\n`, 'bold');

  // Seskupení podle Priority
  const highPriority = implementations.filter(i => i.severity === 'high');
  const mediumPriority = implementations.filter(i => i.severity !== 'high');

  if (highPriority.length > 0) {
    log('🔴 VYSOKÁ PRIORITA:\n', 'red');
    highPriority.forEach((impl, idx) => {
      log(`  ${idx + 1}. ${impl.file}:${impl.line}`, 'yellow');
      log(`     Funkce: ${impl.functionName}`, 'dim');
      log(`     Typ: ${impl.analysisType}`, 'dim');
    });
    log('');
  }

  if (mediumPriority.length > 0) {
    log('🟡 BĚŽNÁ PRIORITA:\n', 'blue');
    mediumPriority.forEach((impl, idx) => {
      log(`  ${idx + 1}. ${impl.file}:${impl.line}`, 'yellow');
      log(`     Funkce: ${impl.functionName}`, 'dim');
      log(`     Typ: ${impl.analysisType}`, 'dim');
    });
    log('');
  }

  return implementations;
}

/**
 * Exportuje implementace do HTML report
 */
function exportHtmlReport(implementations, outputPath) {
  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Implementační šablony</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 10px; }
    .stats { 
      background: white; 
      padding: 15px; 
      border-radius: 5px; 
      margin-bottom: 20px;
      border-left: 4px solid #0078d4;
    }
    .stat { display: inline-block; margin-right: 30px; }
    .stat-label { color: #666; font-size: 0.9em; }
    .stat-value { font-weight: bold; color: #0078d4; font-size: 1.5em; }
    .item { 
      background: white; 
      padding: 20px; 
      margin-bottom: 15px; 
      border-radius: 5px;
      border-left: 4px solid #f0ad4e;
    }
    .item.high { border-left-color: #e74c3c; }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      margin-bottom: 15px;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    .file { color: #0078d4; font-weight: bold; }
    .line { color: #999; font-size: 0.9em; }
    .type { 
      display: inline-block;
      background: #f0f0f0;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 0.85em;
      color: #666;
      margin-top: 10px;
    }
    .type.high { background: #ffebee; color: #c62828; }
    pre {
      background: #f8f8f8;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 15px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 0.95em;
      margin-top: 10px;
    }
    .template-box {
      background: #f0f8ff;
      border: 2px dashed #0078d4;
      padding: 15px;
      border-radius: 4px;
      margin-top: 10px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.8em;
      font-weight: bold;
      margin-left: 10px;
    }
    .badge.high { background: #ffcdd2; color: #c62828; }
    .badge.medium { background: #fff3cd; color: #856404; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔧 Generátor Implementačních Šablon</h1>
    <div class="stats">
      <div class="stat">
        <div class="stat-label">Celkem šablon</div>
        <div class="stat-value">${implementations.length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Vysoká priorita</div>
        <div class="stat-value">${implementations.filter(i => i.severity === 'high').length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Běžná priorita</div>
        <div class="stat-value">${implementations.filter(i => i.severity !== 'high').length}</div>
      </div>
    </div>

    ${implementations.map((impl, idx) => `
      <div class="item ${impl.severity === 'high' ? 'high' : ''}">
        <div class="header">
          <div>
            <span class="file">${impl.file}</span>
            <span class="line">: ${impl.line}</span>
            <span class="badge ${impl.severity}">${impl.severity.toUpperCase()}</span>
          </div>
          <div>${idx + 1}/${implementations.length}</div>
        </div>
        
        <div>
          <strong>Funkce:</strong> <code>${impl.functionName}</code>
          <div class="type ${impl.severity === 'high' ? 'high' : ''}">
            <strong>Typ:</strong> ${impl.analysisType} | <strong>Problém:</strong> ${impl.type}
          </div>
        </div>

        <div class="template-box">
          <strong>📝 Doporučená implementace:</strong>
          <pre>${escapeHtml(impl.template)}</pre>
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>`;

  fs.writeFileSync(outputPath, html);
  log(`✅ HTML report vyexportován: ${outputPath}`, 'green');
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Main
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    log('\n❌ Chyba: Je potřeba zadat cestu k JSON souboru\n', 'red');
    log('Použití:', 'yellow');
    log('  node generate-implementation.js scan-results.json', 'yellow');
    log('  node generate-implementation.js scan-results.json --html report.html', 'yellow');
    process.exit(1);
  }

  const jsonFile = args[0];
  const htmlOutput = args.includes('--html') ? args[args.indexOf('--html') + 1] : null;

  if (!fs.existsSync(jsonFile)) {
    log(`❌ Soubor neexistuje: ${jsonFile}`, 'red');
    process.exit(1);
  }

  const implementations = processIncompleteReport(jsonFile);
  
  if (implementations && implementations.length > 0) {
    const report = generateReport(implementations);
    
    if (htmlOutput) {
      exportHtmlReport(implementations, htmlOutput);
    }

    log('\n✨ Generování šablon hotovo!\n', 'green');
  } else {
    log('ℹ️  Žádné neúplné funkce k vygenerování\n', 'cyan');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
