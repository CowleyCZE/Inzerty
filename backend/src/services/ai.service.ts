/**
 * AI Service - AI operace a integrace s Ollama
 * 
 * Poskytuje AI funkcionalitu s:
 * - Model extraction
 * - Embedding generation
 * - AI message generation
 * - Fraud detection
 * - Cache management
 */

import axios from 'axios';
import { ollamaManager, getAICacheKey, getCachedAIResponse, setCachedAIResponse } from '../utils/index.js';
import { pushRuntimeLog } from '../utils/logger.js';

export interface MessageContext {
  match: any;
  side: 'seller' | 'buyer';
  channel: 'bazos' | 'sms' | 'email';
  previousMessages?: any[];
  userStyle?: 'formal' | 'friendly' | 'direct';
}

export interface AIMessageResult {
  text: string;
  subject?: string;
  reasoning?: string;
}

export interface FraudAnalysisResult {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  flags: FraudFlag[];
  recommendation: string;
}

export interface FraudFlag {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: string;
}

export interface MeetingSuggestion {
  place: string;
  type: 'kavárna' | 'nákupní centrum' | 'nádraží' | 'veřejné';
  safetyRating: number;
  reasoning: string;
}

/**
 * Extrakce modelu z inzerátu pomocí AI
 */
export const extractModelWithAI = async (
  title: string,
  description: string
): Promise<string> => {
  const ollamaModel = ollamaManager.getModel();

  if (isEmbeddingOnlyModel(ollamaModel)) {
    if (!hasLoggedGenerateUnsupportedWarning) {
      pushRuntimeLog(
        `Ollama model "${ollamaModel}" je embedding-only. Používám heuristickou extrakci modelu.`,
        'system'
      );
      hasLoggedGenerateUnsupportedWarning = true;
    }
    return extractModelHeuristic(title, description);
  }

  try {
    const prompt = `Extract only the specific mobile phone model name and its storage capacity (in GB) from this ad.
Format: "Model Name GB". Exclude brand.
If it's an iPhone, include the number and Pro/Max/Plus.
Title: "${title}"
Description: "${description.substring(0, 100)}"
Model:`;

    const cacheKey = getAICacheKey(prompt, ollamaModel);
    const cached = getCachedAIResponse(cacheKey);
    if (cached) return cached;

    const response = await axios.post(
      ollamaManager.createUrl('/api/generate'),
      {
        model: ollamaModel,
        prompt: prompt,
        stream: false,
        options: {
          num_ctx: 2048,
          temperature: 0.1,
        },
      },
      { timeout: 30000 }
    );

    const result = response.data.response.trim();
    setCachedAIResponse(cacheKey, result);
    return result;
  } catch (error: any) {
    const details = String(error.response?.data?.error || '').toLowerCase();
    if (details.includes('does not support generate')) {
      if (!hasLoggedGenerateUnsupportedWarning) {
        pushRuntimeLog(
          `Ollama model "${ollamaModel}" nepodporuje /api/generate. Používám heuristickou extrakci modelu.`,
          'system'
        );
        hasLoggedGenerateUnsupportedWarning = true;
      }
      return extractModelHeuristic(title, description);
    }
    console.error('AI Extraction failed:', error.message);
    return extractModelHeuristic(title, description);
  }
};

/**
 * Heuristická extrakce modelu (fallback)
 */
export const extractModelHeuristic = (title: string, description: string): string => {
  const text = `${title} ${description}`.toLowerCase();

  // iPhone pattern
  const iphoneMatch = text.match(/iphone\s*(\d+)\s*(pro|max|plus)?\s*(\d{2,3})?gb/i);
  if (iphoneMatch) {
    return `iPhone ${iphoneMatch[1]}${iphoneMatch[2] ? ' ' + iphoneMatch[2] : ''}${iphoneMatch[3] ? ' ' + iphoneMatch[3] + 'GB' : ''}`.trim();
  }

  // Samsung pattern
  const samsungMatch = text.match(/galaxy\s*(s|a|z|note)\s*(\d+[a-z]?)\s*(\d{2,3})?gb/i);
  if (samsungMatch) {
    return `Galaxy ${samsungMatch[1]}${samsungMatch[2]}${samsungMatch[3] ? ' ' + samsungMatch[3] + 'GB' : ''}`.trim();
  }

  // Generic pattern
  const genericMatch = text.match(/([a-z]+\s*\d+[a-z]?(?:\s*pro|\s*max|\s*plus)?)(?:\s+(\d{2,3})gb)?/i);
  if (genericMatch) {
    return `${genericMatch[1]}${genericMatch[2] ? ' ' + genericMatch[2] + 'GB' : ''}`.trim();
  }

  return title.substring(0, 50);
};

/**
 * Získání embeddingu z Ollama
 */
export const getEmbeddingFromOllama = async (text: string): Promise<number[] | null> => {
  try {
    const ollamaModel = ollamaManager.getModel();
    const cacheKey = getAICacheKey(`embedding:${text}`, ollamaModel);
    const cached = getCachedAIResponse(cacheKey);
    if (cached) return cached;

    const response = await axios.post(
      ollamaManager.createUrl('/api/embeddings'),
      {
        model: ollamaModel,
        prompt: text,
        options: {
          num_ctx: 2048,
        },
      },
      { timeout: 30000 }
    );

    const embedding = response.data.embedding || null;
    if (embedding) {
      setCachedAIResponse(cacheKey, embedding);
    }
    return embedding;
  } catch (error) {
    console.error('Embedding failed:', error);
    return null;
  }
};

/**
 * Generování AI zprávy pro komunikaci
 */
export const generateAIMessage = async (context: MessageContext): Promise<AIMessageResult> => {
  const { match, side, channel, previousMessages = [], userStyle = 'friendly' } = context;
  const counterpart = side === 'seller' ? match.offer : match.demand;
  const otherSide = side === 'seller' ? match.demand : match.offer;

  const prompt = `
Generuj přirozenou lidskou zprávu pro ${side === 'seller' ? 'prodávajícího' : 'kupujícího'} na českém bazaru.

Kontext obchodu:
- Nabídka (co kupujeme): ${match.offer.title} za ${match.offer.price} (${match.offer.location})
- Poptávka (co prodáváme): ${match.demand.title} za ${match.demand.price} (${match.demand.location})
- Potenciální zisk: ${match.arbitrageScore} Kč
- Podobnost: ${match.similarityScore}%

${side === 'seller' ? `
Kontaktujeme PRODÁVAJÍCÍHO (${counterpart.title}):
- Chceme koupit jeho telefon: ${counterpart.title}
- Máme již zájemce který hledá: ${otherSide.title}
` : `
Kontaktujeme KUPUJÍCÍHO (${counterpart.title}):
- Hledá: ${counterpart.title}
- Máme k dispozici: ${otherSide.title}
- Naše cena: ${otherSide.price}
`}

${previousMessages.length > 0 ? `
Historie komunikace:
${previousMessages.map((m: any) => `- ${m.sender === 'user' ? 'My' : 'Oni'}: ${m.message}`).join('\n')}
` : 'Toto je první zpráva.'}

Styl komunikace: ${userStyle}
Kanál: ${channel}

DŮLEŽITÉ POŽADAVKY:
1. Zpráva musí znít lidsky, ne jako bot
2. Nikdy nepoužívat fráze jako "Inzerty Bot", "automatizovaná zpráva", "AI"
3. Být zdvořilý ale přímý
4. ${side === 'seller' ? 'Prodat zájem - chci koupit jeho telefon' : 'Nabídnout konkrétní telefon který máme skladem'}
5. Nezmiňovat osobní předání pokud to není nutné
6. Maximálně ${channel === 'sms' ? '50 slov' : channel === 'bazos' ? '100 slov' : '150 slov'}

Formát odpovědi JSON:
{
  "text": "vygenerovaná zpráva",
  ${channel === 'email' ? '"subject": "předmět emailu",' : ''}
  "reasoning": "krátké vysvětlení proč byla zpráva generována tímto způsobem"
}
`;

  try {
    const ollamaModel = ollamaManager.getModel();
    const cacheKey = getAICacheKey(prompt, ollamaModel);
    const cached = getCachedAIResponse(cacheKey);
    if (cached) return cached;

    const response = await axios.post(
      ollamaManager.createUrl('/api/generate'),
      {
        model: ollamaModel,
        prompt: prompt,
        stream: false,
        options: {
          num_ctx: 2048,
          temperature: 0.7,
        },
      },
      { timeout: 60000 }
    );

    const rawText = response.data.response.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      setCachedAIResponse(cacheKey, result);
      return result;
    }

    // Fallback
    return {
      text: generateFallbackMessage(context),
      reasoning: 'AI parsing failed, using fallback',
    };
  } catch (error) {
    console.error('AI message generation failed:', error);
    return {
      text: generateFallbackMessage(context),
      reasoning: 'AI unavailable, using fallback',
    };
  }
};

/**
 * Fallback zpráva když AI není dostupná
 */
const generateFallbackMessage = (context: MessageContext): string => {
  const { match, side, channel } = context;
  const counterpart = side === 'seller' ? match.offer : match.demand;
  const otherSide = side === 'seller' ? match.demand : match.offer;

  if (side === 'seller') {
    return `Dobrý den,

mám zájem o Váš inzerát "${counterpart.title}" za ${counterpart.price}.

Jsem vážný zájemce a mám již připraveného kupujícího.

Napište mi prosím více informací.

Hezký den`;
  } else {
    return `Dobrý den,

viděl jsem Váš inzerát "${counterpart.title}". Mám k dispozici ${otherSide.title} za ${otherSide.price}.

Zařízení je plně funkční a testované.

Napište mi prosím, zda máte zájem.

Hezký den`;
  }
};

/**
 * AI analýza na fraud detection
 */
export const analyzeFraud = async (match: any): Promise<FraudAnalysisResult> => {
  const prompt = `
Analyzuj tento obchod na známky podvodu nebo rizika:

Inzerát nabídky:
- Titulek: ${match.offer.title}
- Cena: ${match.offer.price} Kč
- Popis: ${match.offer.description || 'Žádný popis'}
- Lokalita: ${match.offer.location || 'Neznámá'}

Inzerát poptávky:
- Titulek: ${match.demand.title}
- Cena: ${match.demand.price} Kč
- Lokalita: ${match.demand.location || 'Neznámá'}

Zisk z obchodu: ${match.arbitrageScore || 0} Kč

Hledej tyto red flags:
1. Podezřele nízká cena (výrazně pod tržní)
2. Tlak na rychlost ("ihned", "dnes", "spěchá", "nutno prodat")
3. Odmítání osobního předání
4. Požadavek na platbu předem
5. Podezřelý jazyk (gramatické chyby, generické texty)
6. Chybějící detaily o zařízení
7. Prodejce z jiné země
8. Požadavek na soukromé údaje
9. Příliš dobrá nabídka (nevěřitelně vysoký zisk)
10. Nekonzistence v informacích

Ohodnoť riziko 0-100 a přiřaď úroveň:
- 0-24: low
- 25-49: medium
- 50-79: high
- 80-100: critical

Formát odpovědi JSON:
{
  "riskLevel": "low|medium|high|critical",
  "riskScore": number,
  "flags": [
    {"type": string, "severity": "low|medium|high", "description": string, "evidence": string}
  ],
  "recommendation": string
}
`;

  try {
    const ollamaModel = ollamaManager.getModel();
    const cacheKey = getAICacheKey(prompt, ollamaModel);
    const cached = getCachedAIResponse(cacheKey);
    if (cached) return cached;

    const response = await axios.post(
      ollamaManager.createUrl('/api/generate'),
      {
        model: ollamaModel,
        prompt: prompt,
        stream: false,
        options: {
          num_ctx: 2048,
          temperature: 0.1,
        },
      },
      { timeout: 45000 }
    );

    const rawText = response.data.response.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      setCachedAIResponse(cacheKey, result);
      return result;
    }

    // Fallback
    return {
      riskLevel: 'low',
      riskScore: 10,
      flags: [],
      recommendation: 'Nízké riziko (AI fallback)',
    };
  } catch (error) {
    console.error('Fraud analysis failed:', error);
    return {
      riskLevel: 'low',
      riskScore: 10,
      flags: [],
      recommendation: 'Nízké riziko (AI nedostupná)',
    };
  }
};

/**
 * AI návrhy míst pro předání
 */
export const suggestMeetingPlaces = async (
  offerLocation: string,
  demandLocation: string
): Promise<{ suggestions: MeetingSuggestion[] }> => {
  const prompt = `
Navrhni vhodná místa pro předání mobilního telefonu:
Lokalita nabídka: ${offerLocation || 'Neznámá'}
Lokalita poptávka: ${demandLocation || 'Neznámá'}

Navrhni 3 bezpečná veřejná místa (kavárna, nákupní centrum, nádraží) s ratingem bezpečnosti 0-100.

Formát odpovědi JSON:
{
  "suggestions": [
    {"place": "string", "type": "kavárna|nákupní centrum|nádraží|veřejné", "safetyRating": number, "reasoning": "string"}
  ]
}
`;

  try {
    const ollamaModel = ollamaManager.getModel();
    const cacheKey = getAICacheKey(prompt, ollamaModel);
    const cached = getCachedAIResponse(cacheKey);
    if (cached) return cached;

    const response = await axios.post(
      ollamaManager.createUrl('/api/generate'),
      {
        model: ollamaModel,
        prompt: prompt,
        stream: false,
        options: {
          num_ctx: 2048,
          temperature: 0.2,
        },
      },
      { timeout: 45000 }
    );

    const rawText = response.data.response.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      setCachedAIResponse(cacheKey, result);
      return result;
    }

    // Fallback
    return {
      suggestions: [
        {
          place: 'Kavárna v centru',
          type: 'kavárna',
          safetyRating: 85,
          reasoning: 'Veřejné místo s dobrou dostupností',
        },
      ],
    };
  } catch (error) {
    console.error('Meeting suggestions failed:', error);
    return {
      suggestions: [
        {
          place: 'Kavárna v centru (AI fallback)',
          type: 'kavárna',
          safetyRating: 85,
          reasoning: 'Fallback místo',
        },
      ],
    };
  }
};

/**
 * Priorita scoring pro obchody
 */
export const calculatePriorityScore = async (
  match: any,
  userCapacity?: {
    currentDeals: number;
    maxDeals: number;
    availableTime: number;
  }
): Promise<{
  score: number;
  recommendation: 'prioritize' | 'normal' | 'skip';
  reasoning: string;
  breakdown: {
    profitability: number;
    trustworthiness: number;
    urgency: number;
    marketTrend: number;
    capacity: number;
  };
}> => {
  const prompt = `
Vypočítej prioritu tohoto obchodu pro arbitráž mobilních telefonů.

Obchod:
- Nabídka: ${match.offer.title} za ${match.offer.price} Kč
- Poptávka: ${match.demand.title} za ${match.demand.price} Kč
- Zisk: ${match.arbitrageScore || 0} Kč
- Podobnost: ${match.similarityScore || 0}%
- Stáří nabídky: ${match.offer.date_posted || 'neznámé'}
- Stáří poptávky: ${match.demand.date_posted || 'neznámé'}

${userCapacity ? `
Kapacita uživatele:
- Aktuální obchody: ${userCapacity.currentDeals}
- Maximální kapacita: ${userCapacity.maxDeals}
- Dostupný čas: ${userCapacity.availableTime} hodin/týden
` : ''}

Ohodnoť prioritu 0-100 na základě:
1. Profitabilita (30%) - výše zisku
2. Důvěryhodnost (25%) - věrohodnost ceny
3. Urgence (20%) - stáří inzerátů
4. Tržní trend (15%) - poptávka po modelu
5. Kapacita (10%) - dostupná kapacita uživatele

Doporučení:
- prioritize: score >= 70
- normal: score 40-69
- skip: score < 40

Formát odpovědi JSON:
{
  "score": number,
  "recommendation": "prioritize|normal|skip",
  "reasoning": "string",
  "breakdown": {
    "profitability": number,
    "trustworthiness": number,
    "urgency": number,
    "marketTrend": number,
    "capacity": number
  }
}
`;

  try {
    const ollamaModel = ollamaManager.getModel();
    const cacheKey = getAICacheKey(prompt, ollamaModel);
    const cached = getCachedAIResponse(cacheKey);
    if (cached) return cached;

    const response = await axios.post(
      ollamaManager.createUrl('/api/generate'),
      {
        model: ollamaModel,
        prompt: prompt,
        stream: false,
        options: {
          num_ctx: 2048,
          temperature: 0.1,
        },
      },
      { timeout: 45000 }
    );

    const rawText = response.data.response.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      setCachedAIResponse(cacheKey, result);
      return result;
    }

    // Fallback
    return {
      score: 50,
      recommendation: 'normal',
      reasoning: 'AI fallback - průměrná priorita',
      breakdown: {
        profitability: 50,
        trustworthiness: 50,
        urgency: 50,
        marketTrend: 50,
        capacity: 50,
      },
    };
  } catch (error) {
    console.error('Priority calculation failed:', error);
    return {
      score: 50,
      recommendation: 'normal',
      reasoning: 'AI nedostupná - průměrná priorita',
      breakdown: {
        profitability: 50,
        trustworthiness: 50,
        urgency: 50,
        marketTrend: 50,
        capacity: 50,
      },
    };
  }
};

// ========================================
// Helper funkce
// ========================================

let hasLoggedGenerateUnsupportedWarning = false;

const isEmbeddingOnlyModel = (model: string): boolean => {
  const embeddingOnlyModels = ['all-minilm', 'mxbai-embed', 'nomic-embed', 'bge-m3', 'bge-large'];
  return embeddingOnlyModels.some(m => model.toLowerCase().includes(m));
};
