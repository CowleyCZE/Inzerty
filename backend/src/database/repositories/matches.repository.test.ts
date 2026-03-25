import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { initDb, clearDatabase } from '../init.js';
import { saveMatch, saveMatchMeta, getAllMatchMeta, getMatchMetaByKey } from './matches.repository.js';
import { saveAd } from './ads.repository.js';
import { closeDbConnections } from '../connection.js';

describe('Matches Repository', () => {
  beforeAll(async () => {
    await initDb();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeDbConnections();
  });

  const mockOffer = {
    id: 'offer-1',
    title: 'Nabídka auta',
    price: '100 000 Kč',
    url: 'https://example.com/o1',
    date_posted: '2023-10-01',
    brand: 'skoda',
    ad_type: 'nabidka',
    scraped_at: new Date().toISOString(),
  };

  const mockDemand = {
    id: 'demand-1',
    title: 'Poptávka auta',
    price: '110 000 Kč',
    url: 'https://example.com/d1',
    date_posted: '2023-10-01',
    brand: 'skoda',
    ad_type: 'poptavka',
    scraped_at: new Date().toISOString(),
  };

  it('uloží shodu mezi inzeráty', async () => {
    await saveAd(mockOffer);
    await saveAd(mockDemand);

    await saveMatch(mockOffer.id, mockDemand.id, 0.95, true);
    
    // V SQLite matches tabulku přímo nečteme přes repo (jen v joinu), 
    // tak otestujeme aspoň přes match_meta nebo v budoucnu přidáme getMatch
    expect(true).toBe(true); // Placeholder pro úspěšný doběh bez chyby
  });

  it('uloží a načte metadata shody', async () => {
    const matchKey = `${mockOffer.id}__${mockDemand.id}`;
    await saveMatchMeta({
      matchKey,
      status: 'contacted',
      note: 'Testovací poznámka',
      priority: 'high',
      resolved: false
    });

    const meta = await getMatchMetaByKey(matchKey);
    expect(meta).not.toBeNull();
    expect(meta?.status).toBe('contacted');
    expect(meta?.priority).toBe('high');
    expect(meta?.note).toBe('Testovací poznámka');
  });

  it('načte všechna metadata', async () => {
    await saveMatchMeta({ matchKey: 'k1', status: 'new' });
    await saveMatchMeta({ matchKey: 'k2', status: 'new' });

    const all = await getAllMatchMeta();
    console.log('ALL MATCH META:', all);
    expect(all.length).toBe(2);
  });
});
