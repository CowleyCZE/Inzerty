import { describe, it, expect, beforeEach } from 'vitest';
import { ScraperFactory, getScraper } from './ScraperFactory.js';
import { BazosCZScraper } from './BazosCZScraper.js';
import { BazosSKScraper } from './BazosSKScraper.js';
import type { AdSource } from '../../../types.js';

describe('ScraperFactory', () => {
  beforeEach(() => {
    // Clear factory state before each test
    ScraperFactory.getAllScrapers().forEach((_, key) => {
      ScraperFactory.remove(key);
    });
  });

  it('creates BazosCZScraper correctly', () => {
    const scraper = ScraperFactory.create('bazos_cz');
    expect(scraper).toBeInstanceOf(BazosCZScraper);
  });

  it('creates BazosSKScraper correctly', () => {
    const scraper = ScraperFactory.create('bazos_sk');
    expect(scraper).toBeInstanceOf(BazosSKScraper);
  });

  it('throws an error for unsupported scraper source', () => {
    expect(() => ScraperFactory.create('unsupported_source' as AdSource)).toThrow('Scraper pro zdroj "unsupported_source" není implementován');
  });

  it('caches the scraper instances', () => {
    const scraper1 = ScraperFactory.create('bazos_cz');
    const scraper2 = ScraperFactory.create('bazos_cz');
    
    // Should be exactly the same instance reference
    expect(scraper1).toBe(scraper2);
  });

  it('returns available sources', () => {
    const sources = ScraperFactory.getAvailableSources();
    expect(sources).toContain('bazos_cz');
    expect(sources).toContain('bazos_sk');
  });

  it('removes scraper from cache', () => {
    const scraper1 = ScraperFactory.create('bazos_cz');
    ScraperFactory.remove('bazos_cz');
    const scraper2 = ScraperFactory.create('bazos_cz');
    
    // Should be a different instance since cache was cleared
    expect(scraper1).not.toBe(scraper2);
  });

  it('helper function getScraper works as alias', () => {
    const scraper = getScraper('bazos_cz');
    expect(scraper).toBeInstanceOf(BazosCZScraper);
  });
});
