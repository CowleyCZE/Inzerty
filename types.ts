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
}

export interface Config {
  brand: string;
  adType: string;
  itemCount: number;
  url: string;
  comparisonMethod?: string;
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
