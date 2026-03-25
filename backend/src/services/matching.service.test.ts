import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findMatches } from './matching.service.js';
import * as database from '../database.js';

// Mocks
vi.mock('../database.js', () => ({
  getAllAdsByType: vi.fn(),
  saveMatch: vi.fn(),
  initDealState: vi.fn(),
  getResolvedMatchKeys: vi.fn(() => []),
  updateAdModelAi: vi.fn(),
  updateAdEmbedding: vi.fn(),
  usingPostgres: vi.fn(() => false),
  isPgVectorAvailable: vi.fn(() => false),
  getPgVectorSimilarities: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  pushRuntimeLog: vi.fn(),
}));

vi.mock('../utils/index.js', () => ({
  ollamaManager: {
    checkStatus: vi.fn(() => false),
    getModel: vi.fn(() => 'test-model'),
    createUrl: vi.fn(() => 'http://localhost:11434/api/generate'),
  },
  getAICacheKey: vi.fn(),
  getCachedAIResponse: vi.fn(),
  setCachedAIResponse: vi.fn(),
}));

describe('Matching Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty when no ads available', async () => {
    vi.mocked(database.getAllAdsByType).mockResolvedValue([]);
    
    const result = await findMatches({ comparisonMethod: 'local-keyword' });
    
    expect(result.data).toEqual([]);
    expect(result.summary.totalMatches).toBe(0);
  });

  it('matches ad perfectly when demand and offer match', async () => {
    // Override the mock for this specific test
    vi.mocked((await import('../utils/index.js')).ollamaManager.checkStatus).mockResolvedValue(true);

    const mockOffer = {
      id: 'o1',
      brand: 'Apple',
      url: 'url1',
      price: '10000',
      title: 'iPhone 13 Pro 128GB',
      description: 'Super stav',
      date_posted: new Date().toISOString(),
      model_ai: 'iPhone 13 Pro 128GB'
    };
    const mockDemand = {
      id: 'd1',
      brand: 'Apple',
      url: 'url2',
      price: '15000',
      title: 'Koupím iPhone 13 Pro 128GB',
      description: 'Rychlé jednání',
      date_posted: new Date().toISOString(),
      model_ai: 'iPhone 13 Pro 128GB'
    };

    vi.mocked(database.getAllAdsByType).mockImplementation(async (type) => {
      if (type === 'nabidka') return [mockOffer];
      if (type === 'poptavka') return [mockDemand];
      return [];
    });

    const result = await findMatches({ comparisonMethod: 'ollama' });
    
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.offer.id).toBe('o1');
    expect(result.data[0]?.demand.id).toBe('d1');
    expect(result.data[0]?.arbitrageScore).toBe(5000); // 15000 - 10000
    
    // Verify database calls
    expect(database.saveMatch).toHaveBeenCalledWith('o1', 'd1', expect.any(Number), true);
    expect(database.initDealState).toHaveBeenCalledWith('url1__url2');
  });

  it('ignores matches where offer is more expensive than demand', async () => {
     const mockOffer = {
      id: 'o1',
      brand: 'Apple',
      url: 'url1',
      price: '20000',
      title: 'iPhone 13 Pro 128GB',
      description: 'Super stav',
    };
    const mockDemand = {
      id: 'd1',
      brand: 'Apple',
      url: 'url2',
      price: '15000',
      title: 'Koupím iPhone 13 Pro 128GB',
      description: 'Rychlé jednání',
    };

    vi.mocked(database.getAllAdsByType).mockImplementation(async (type) => {
      if (type === 'nabidka') return [mockOffer];
      if (type === 'poptavka') return [mockDemand];
      return [];
    });

    const result = await findMatches({ comparisonMethod: 'local-keyword' });
    
    expect(result.data.length).toBe(0);
  });

});
