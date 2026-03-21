// ========================================
// Multi-Platform Support - Ad Types
// ========================================

export type AdSource = 
  | 'bazos_cz' 
  | 'bazos_sk' 
  | 'sbazar' 
  | 'mobilnet' 
  | 'aukro' 
  | 'vinted' 
  | 'facebook_marketplace'
  | 'hyperinzerce'
  | 'annonce';

export const AdSourceName: Record<AdSource, string> = {
  bazos_cz: 'Bazoš.cz',
  bazos_sk: 'Bazoš.sk',
  sbazar: 'Sbazar.cz',
  mobilnet: 'Mobilnet.cz',
  aukro: 'Aukro.cz',
  vinted: 'Vinted.cz',
  facebook_marketplace: 'Facebook Marketplace',
  hyperinzerce: 'Hyperinzerce.cz',
  annonce: 'Annonce.cz',
};

export interface Ad {
  id: string;
  title: string;
  price: string;
  location: string;
  description: string;
  date_posted: string;
  url: string;
  image_url: string;
  ad_type: string;
  brand: string;
  scraped_at: string;
  views: string;
  is_top: boolean;
  link?: string;
  similarity?: number;
  ai?: boolean;
  // Multi-platform fields
  source: AdSource;
  external_id?: string;
  posted_at?: string;
  seller?: {
    name?: string;
    phone?: string;
    rating?: number;
    verified?: boolean;
  };
  metadata?: Record<string, any>;
}

export interface ScraperResult {
  ads: Ad[];
  savedAdsCount: number;
  error?: string;
  warnings?: string[];
  metadata?: {
    scrapedAt: string;
    source: AdSource;
    pagesScraped: number;
    totalAdsFound: number;
  };
}

export interface ScraperConfig {
  enabled: boolean;
  source: AdSource;
  baseUrl: string;
  categories: {
    nabidka: string[];
    poptavka: string[];
  };
  selectors: {
    adList: string;
    adItem: string;
    title: string;
    price: string;
    link: string;
    description?: string;
    location?: string;
    date?: string;
    image?: string;
    seller?: string;
  };
  scrapingOptions: {
    delay: number;
    jitter: number;
    maxPages: number;
    maxAdsPerType: number;
    stopOnKnownAd: boolean;
    userAgents: string[];
  };
}

export type MatchStatus = 'new' | 'review' | 'contacted' | 'negotiation' | 'closed';
export type MatchPriority = 'low' | 'medium' | 'high' | 'critical';

export interface DueDiligenceChecklist {
  imeiVerified: boolean;
  batteryHealthChecked: boolean;
  displayChecked: boolean;
  accessoriesChecked: boolean;
  warrantyProofChecked: boolean;
}

export interface MatchMeta {
  status: MatchStatus;
  note: string;
  priority: MatchPriority;
  lastActionAt: string;
  resolved: boolean;
  followUpAt: string;
  followUpState: 'none' | 'waiting' | 'no_response' | 'done';
  checklist: DueDiligenceChecklist;
}

export interface MatchItem {
  offer: Ad;
  demand: Ad;
  arbitrageScore?: number;
  opportunityScore?: number;
  realOpportunityScore?: number;
  expectedNetProfit?: number;
  locationScore?: number;
  priceTrustScore?: number;
  similarity?: number;
  marginScore?: number;
  freshness?: number;
}

export interface ScrapeSummaryData {
  nabidka: number;
  poptavka: number;
  savedNabidka?: number;
  savedPoptavka?: number;
  healthWarning?: string;
}

export interface Config {
  brand: string;
  adType: string;
  itemCount: number;
  url: string;
  comparisonMethod?: string;
  ollamaModel?: string;
  scrapingOptions?: {
    stopOnKnownAd: boolean;
    maxAdsPerTypePerBrand: number;
  };
  filterRules?: {
    blacklistTerms: string[];
    whitelistModels: string[];
    minPrice: number | null;
    maxPrice: number | null;
    minStorageGb: number | null;
  };
  selectors: {
    item: string;
    title: string;
    price: string;
    date: string;
    link: string;
    description?: string;
    location?: string;
  };
  // Multi-platform support
  enabledPlatforms?: AdSource[];
}


// Enums are converted to plain JavaScript objects.

export const AdType = {
  NABIDKA: 'nabidka',
  POPTAVKA: 'poptavka',
};

export interface LogEntry {
  id?: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'system';
  timestamp?: string;
  progress?: number;
}

export const WorkflowStepValue = {
  IDLE: 'idle',
  CONFIG: 'konfigurace',
  INIT_ANTI_DETECTION: 'inicializace_anti_detection',
  SCRAPING: 'scrapovani',
  PARSING: 'parsovani_dat',
  SAVING: 'ukladani_dat',
  MONITORING: 'monitoring',
  DISPLAYING_RESULTS: 'zobrazeni_vysledku',
  ERROR: 'chyba',
};
