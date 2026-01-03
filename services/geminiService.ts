

import { GoogleGenAI } from "@google/genai";
import { AdType } from '../types';
import { GEMINI_MODEL_TEXT } from '../constants.ts'; // Updated extension

const API_KEY = import.meta.env.VITE_API_KEY;

if (!API_KEY) {
  console.error("API klíč pro Gemini není nastaven. Vytvořte soubor .env.local a vložte do něj VITE_API_KEY='váš_klíč'. Služba Gemini nebude funkční.");
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const parseJsonFromText = (text: string): any => {
  let jsonStr = text.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Nepodařilo se parsovat JSON odpověď:", e, "Původní text:", text);
    throw new Error(`Chyba parsování JSON: ${e.message}`);
  }
};


export const generateMockAds = async (brand: string, adType: string, count: number) => {
  if (!ai) {
    console.warn("Gemini AI není inicializováno kvůli chybějícímu nebo neplatnému API klíči. Vracím prázdná data.");
    // Fallback: Return empty array or predefined mock data if API key is missing
    const fallbackAds = Array.from({ length: count }).map((_, i) => ({
      id: crypto.randomUUID(),
      title: `Nouzový (bez API) ${brand} ${adType} ${i + 1}`,
      price: `${Math.floor(Math.random() * 10000) + 1000} Kč`,
      location: "Neznámá Lokace",
      description: "Toto je nouzový inzerát vygenerovaný kvůli chybějícímu API klíči.",
      date_posted: new Date().toLocaleDateString('cs-CZ'),
      url: "#",
      image_url: `https://picsum.photos/seed/${crypto.randomUUID()}/300/200`,
      ad_type: adType,
      brand: brand,
      scraped_at: new Date().toISOString(),
      views: `${Math.floor(Math.random() * 200)}x`,
      is_top: Math.random() < 0.2,
    }));
    alert(`Gemini AI není inicializováno. Ujistěte se, že máte správně nastavený API klíč v souboru .env.local a že jste restartovali server. Zobrazují se nouzová data.`);
    return Promise.resolve(fallbackAds);
  }

  const adTypeDescription = adType === AdType.NABIDKA ? "nabídka (prodej)" : "poptávka (koupě)";

  const prompt = `
Vygeneruj ${count} fiktivních inzerátů na mobilní telefony značky "${brand}" typu "${adTypeDescription}" pro český inzertní portál jako je Bazos.cz.
Každý inzerát musí obsahovat následující pole:
- id: unikátní řetězec (např. UUID)
- title: stručný název inzerátu (max 10 slov)
- price: cena v Kč (např. "5 000 Kč", "Dohodou")
- location: město a PSČ (např. "Praha 1, 110 00")
- description: krátký popis (1-2 věty, max 30 slov)
- date_posted: datum zveřejnění ve formátu DD.MM.RRRR (během posledního měsíce)
- url: fiktivní URL na detail inzerátu (např. "https://fake-bazos.cz/inzerat/12345")
- image_url: URL obrázku (použij "https://picsum.photos/seed/{unikátní_řetězec}/300/200" pro každý inzerát s unikátním seedem)
- views: počet zobrazení jako řetězec (např. "120x")
- is_top: boolean (náhodně true/false)

Odpověď vrať VÝHRADNĚ jako JSON pole objektů. Nepřidávej žádný další text ani vysvětlení.
Příklad jednoho objektu:
{
  "id": "abc-123",
  "title": "Prodám iPhone 12 Mini",
  "price": "8 500 Kč",
  "location": "Brno, 602 00",
  "description": "Skvělý stav, málo používaný, s originálním balením.",
  "date_posted": "15.05.2024",
  "url": "https://fake-bazos.cz/inzerat/iphone-12-mini-brno",
  "image_url": "https://picsum.photos/seed/iphone12mini/300/200",
  "views": "85x",
  "is_top": false
}
`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_TEXT,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.7, // Add some variability
      },
    });

    const rawText = response.text;
    const parsedData = parseJsonFromText(rawText);

    if (!Array.isArray(parsedData)) {
      console.error("Odpověď od Gemini není pole:", parsedData);
      throw new Error("Odpověď od Gemini není ve formátu pole.");
    }

    return parsedData.map((item) => ({
      ...item,
      brand: brand,
      ad_type: adType,
      scraped_at: new Date().toISOString(),
      // Ensure all fields are present, provide defaults if necessary
      id: item.id || crypto.randomUUID(),
      title: item.title || "Neznámý název",
      price: item.price || "N/A",
      location: item.location || "Neznámá lokace",
      description: item.description || "Bez popisu",
      date_posted: item.date_posted || new Date().toLocaleDateString('cs-CZ'),
      url: item.url || "#",
      image_url: item.image_url || `https://picsum.photos/seed/${crypto.randomUUID()}/300/200`,
      views: item.views || "N/A",
      is_top: typeof item.is_top === 'boolean' ? item.is_top : false,
    }));

  } catch (error) {
    console.error("Chyba při komunikaci s Gemini API:", error);
    const fallbackAds = Array.from({ length: count }).map((_, i) => ({
      id: crypto.randomUUID(),
      title: `Nouzový ${brand} ${adType} ${i + 1}`,
      price: `${Math.floor(Math.random() * 10000) + 1000} Kč`,
      location: "Neznámá Lokace",
      description: "Toto je nouzový inzerát vygenerovaný kvůli chybě API.",
      date_posted: new Date().toLocaleDateString('cs-CZ'),
      url: "#",
      image_url: `https://picsum.photos/seed/${crypto.randomUUID()}/300/200`,
      ad_type: adType,
      brand: brand,
      scraped_at: new Date().toISOString(),
      views: `${Math.floor(Math.random() * 200)}x`,
      is_top: Math.random() < 0.2,
    }));
    alert(`Došlo k chybě při komunikaci s Gemini API: ${error.message}. Zobrazují se nouzová data. Zkontrolujte API klíč a konzoli pro detaily.`);
    return fallbackAds;
  }
};