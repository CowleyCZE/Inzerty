import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { initDb, clearDatabase } from '../init.js';
import { saveAd, getAllAds, getAdsByType, getAdById, getAdByUrl, deleteAllAds, getAdsCount } from './ads.repository.js';
import type { AdInput } from './ads.repository.js';
import { closeDbConnections } from '../connection.js';

describe('Ads Repository', () => {
  beforeAll(async () => {
    // Ensure database is initialized
    await initDb();
  });

  beforeEach(async () => {
    // Clear ads table before each test
    await clearDatabase();
  });

  afterAll(async () => {
    // Close database connection
    await closeDbConnections();
  });

  const mockAd: AdInput = {
    id: 'test-ad-1',
    title: 'Testování inzerátu',
    price: '1 234 Kč',
    url: 'https://example.com/test-ad-1',
    date_posted: '2023-10-01',
    brand: 'bmw',
    ad_type: 'nabidka',
    scraped_at: new Date().toISOString(),
    description: 'Popis testovacího inzerátu',
    location: 'Praha',
  };

  it('procentuálně uloží inzerát a načte ho zpět', async () => {
    const saved = await saveAd(mockAd);
    expect(saved).toBe(true);

    const ads = await getAllAds();
    expect(ads.length).toBe(1);
    expect(ads[0]?.title).toBe(mockAd.title);
    expect(ads[0]?.price).toBe(mockAd.price);
    expect(ads[0]?.price_value).toBe(1234);
  });

  it('načte inzerát podle ID', async () => {
    await saveAd(mockAd);
    const ad = await getAdById(mockAd.id);
    expect(ad).not.toBeNull();
    expect(ad?.id).toBe(mockAd.id);
  });

  it('načte inzerát podle URL', async () => {
    await saveAd(mockAd);
    const ad = await getAdByUrl(mockAd.url!);
    expect(ad).not.toBeNull();
    expect(ad?.url).toBe(mockAd.url);
  });

  it('vyfiltruje inzeráty podle typu', async () => {
    await saveAd(mockAd);
    await saveAd({
      ...mockAd,
      id: 'test-ad-2',
      url: 'https://example.com/test-ad-2',
      ad_type: 'poptavka'
    });

    const nabidky = await getAdsByType('nabidka');
    const poptavky = await getAdsByType('poptavka');

    expect(nabidky.length).toBe(1);
    expect(poptavky.length).toBe(1);
  });

  it('vrátí správný počet inzerátů', async () => {
    await saveAd(mockAd);
    const count = await getAdsCount();
    expect(count).toBe(1);

    const nabidkaCount = await getAdsCount('nabidka');
    expect(nabidkaCount).toBe(1);

    const poptavkaCount = await getAdsCount('poptavka');
    expect(poptavkaCount).toBe(0);
  });

  it('smaže všechny inzeráty', async () => {
    await saveAd(mockAd);
    await deleteAllAds();
    const count = await getAdsCount();
    expect(count).toBe(0);
  });
});
