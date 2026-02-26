import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
const dbPath = path.join(backendRoot, 'inzerty.db');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(url: string, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // server not ready yet
    }
    await sleep(250);
  }
  throw new Error('Server se nepodařilo spustit v limitu.');
}

async function run() {
  await fs.rm(dbPath, { force: true });

  const server = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: backendRoot,
    env: { ...process.env, MOCK_SCRAPE: '1' },
    stdio: 'pipe',
  });

  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});

  try {
    await waitForServer('http://localhost:3001/logs');

    const scrapeRes = await fetch('http://localhost:3001/scrape-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectors: {
          item: '.inzeraty.inzeratyflex',
          title: '.nadpis',
          price: '.inzeratycena',
          date: '.velikost10',
          link: '.nadpis a',
          description: '.popis',
          location: '.inzeratylok',
        },
        scrapingOptions: {
          stopOnKnownAd: false,
          maxAdsPerTypePerBrand: 3,
        },
      }),
    });

    if (!scrapeRes.ok) {
      throw new Error(`Scrape endpoint selhal: HTTP ${scrapeRes.status}`);
    }

    const scrapeJson = await scrapeRes.json();
    if ((scrapeJson?.data?.savedNabidkaCount ?? 0) <= 0) {
      throw new Error('Integrační test: expected savedNabidkaCount > 0');
    }
    if ((scrapeJson?.data?.savedPoptavkaCount ?? 0) <= 0) {
      throw new Error('Integrační test: expected savedPoptavkaCount > 0');
    }

    const compareRes = await fetch('http://localhost:3001/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comparisonMethod: 'local-keyword', hideResolved: false }),
    });

    if (!compareRes.ok) {
      throw new Error(`Compare endpoint selhal: HTTP ${compareRes.status}`);
    }

    const compareJson = await compareRes.json();
    if (typeof compareJson?.message !== 'string' || compareJson.message.includes('není dostatek dat')) {
      throw new Error('Integrační test: compare endpoint hlásí nedostatek dat.');
    }

    const logsRes = await fetch('http://localhost:3001/logs');
    const logsJson = await logsRes.json();
    const hasDatasetLog = Array.isArray(logsJson.logs)
      && logsJson.logs.some((log: any) => String(log.message || '').includes('Načtená data pro porovnání: nabídky='));

    if (!hasDatasetLog) {
      throw new Error('Integrační test: v logu chybí záznam o načtených datech porovnání.');
    }

    console.log('Integrační test /scrape-all + /compare proběhl úspěšně.');
    process.exit(0);
  } finally {
    server.kill('SIGKILL');
    await sleep(500);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
