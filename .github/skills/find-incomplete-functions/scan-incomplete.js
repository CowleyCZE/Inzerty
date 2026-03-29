#!/usr/bin/env node

/**
 * Skript pro skenování workspace a hledání neúplných funkcí
 * Použití: node scan-incomplete.js [cesta] [--json] [--strict]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Konfigurace
const config = {
  patterns: {
    todoFixme: /\/\/\s*(TODO|FIXME|todo|fixme).*$/gm,
    errorStub: /throw\s+(?:new\s+)?Error\s*\(\s*["'](?:not\s+implemented|stub|placeholder|WIP)/gi,
    emptyBody: /(?:async\s+)?(?:function|const|let|var)\s+(\w+)\s*(?:\([^)]*\))?\s*[\{:]\s*[\}]?(?:\s*$|\s*\/\/)/gm,
    notImplemented: /(?:NotImplementedError|unimplemented!|not_implemented)/gi,
    stubMarker: /\/\/\s*(stub|placeholder|WIP|HACK).*$/gm,
  },
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs'],
  excludeDirs: ['node_modules', 'dist', 'build', '.git', '.next', 'coverage', 'vendor'],
};

// Barevný výstup
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(text, color = 'reset') {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const results = [];

    // Prohledávání TODO/FIXME
    let match;
    while ((match = config.patterns.todoFixme.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      results.push({
        type: 'TODO/FIXME',
        line: lineNum,
        match: match[0].trim(),
        severity: match[1].includes('FIXME') ? 'high' : 'medium',
        context: lines[lineNum - 1] || '',
      });
    }

    // Prohledávání error stubů
    while ((match = config.patterns.errorStub.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      results.push({
        type: 'Error Stub',
        line: lineNum,
        match: match[0].trim(),
        severity: 'high',
        context: lines[lineNum - 1] || '',
      });
    }

    // Prohledávání NotImplementedError
    while ((match = config.patterns.notImplemented.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      results.push({
        type: 'NotImplemented',
        line: lineNum,
        match: match[0].trim(),
        severity: 'high',
        context: lines[lineNum - 1] || '',
      });
    }

    // Prohledávání stub markerů
    while ((match = config.patterns.stubMarker.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      results.push({
        type: 'Stub Marker',
        line: lineNum,
        match: match[0].trim(),
        severity: 'medium',
        context: lines[lineNum - 1] || '',
      });
    }

    return results;
  } catch (err) {
    return [];
  }
}

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    // Přeskočit vyloučené adresáře
    if (config.excludeDirs.some((excluded) => filePath.includes(excluded))) {
      return;
    }

    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else if (config.extensions.some((ext) => file.endsWith(ext))) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function main() {
  const args = process.argv.slice(2);
  const scanPath = args[0] || process.cwd();
  const outputJson = args.includes('--json');
  const strict = args.includes('--strict');

  if (!outputJson) {
    log(`\n🔍 Skenování: ${scanPath}\n`, 'cyan');
  }

  if (!fs.existsSync(scanPath)) {
    if (!outputJson) {
      log(`❌ Cesta neexistuje: ${scanPath}`, 'red');
    }
    process.exit(1);
  }

  const files = walkDir(scanPath);
  const allResults = {};
  let totalCount = 0;

  files.forEach((file) => {
    const results = scanFile(file);
    if (results.length > 0) {
      const relPath = path.relative(scanPath, file);
      allResults[relPath] = results;
      totalCount += results.length;
    }
  });

  if (outputJson) {
    console.log(JSON.stringify(allResults, null, 2));
  } else {
    if (totalCount === 0) {
      log('✅ Žádné neúplné funkce nenalezeny!', 'green');
    } else {
      log(`📋 Nalezeno ${totalCount} neúplných položek\n`, 'bold');

      Object.entries(allResults).forEach(([file, results]) => {
        log(`\n📄 ${file}`, 'blue');
        results.forEach((result) => {
          const severityColor = result.severity === 'high' ? 'red' : 'yellow';
          const severitySymbol = result.severity === 'high' ? '⚠️ ' : '📌';
          log(`  ${severitySymbol} Řádek ${result.line}: [${result.type}]`, severityColor);
          log(`     ${result.match}`, 'dim');
        });
      });
    }

    log(`\n✨ Skenování hotovo!\n`, 'green');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
