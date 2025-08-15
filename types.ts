// All interfaces are removed as they are TypeScript-only features.
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
