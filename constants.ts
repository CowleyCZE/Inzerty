import { AdType } from './types';

export const BRANDS = [
  'Samsung', 'Apple', 'Huawei', 'Motorola', 'Nokia', 'Sony', 'Xiaomi'
];

export const AD_TYPE_OPTIONS = [
  { value: AdType.NABIDKA, label: 'Nabídka (Prodej)' },
  { value: AdType.POPTAVKA, label: 'Poptávka (Koupě)' },
];

export const ITEM_COUNT_OPTIONS = [5, 10, 15];

export const GEMINI_MODEL_TEXT = 'gemini-2.5-flash';

export const ETHICAL_GUIDELINES = {
  title: "Etické Zásady Scrapování",
  points: [
    "Vždy respektujte soubor robots.txt cílového webu.",
    "Omezte frekvenci požadavků (rate limiting), abyste nepřetěžovali server.",
    "Identifikujte svého bota pomocí User-Agent hlavičky (pokud je to vhodné).",
    "Sbírejte pouze veřejně dostupná data, která jsou relevantní k vašemu účelu.",
    "Nesdílejte ani nezneužívejte citlivá nebo osobní data.",
    "Buďte si vědomi právních předpisů (např. GDPR, autorská práva) a dodržujte je.",
    "Zvažte dopad vaší činnosti na cílový web a jeho uživatele."
  ]
};

export const INITIAL_LOG_MESSAGE = "Systém připraven. Nakonfigurujte a spusťte scrapování.";

export const DEFAULT_CONFIG = {
  brand: BRANDS[0],
  adType: AD_TYPE_OPTIONS[0].value,
  itemCount: ITEM_COUNT_OPTIONS[0],
  url: 'https://www.bazos.cz/mobily/',
  selectors: {
    item: '.inzeraty.inzeratyflex',
    title: '.nadpis',
    price: '.inzeratycena',
    date: '.velikost10',
    link: '.nadpis a',
  }
};