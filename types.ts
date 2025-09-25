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
}

export interface Config {
  brand: string;
  adType: string;
  itemCount: number;
  url: string;
  selectors: {
    item: string;
    title: string;
    price: string;
    date: string;
    link: string;
  };
}


// Enums are converted to plain JavaScript objects.

export const AdType = {
  NABIDKA: 'nabidka',
  POPTAVKA: 'poptavka',
};

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