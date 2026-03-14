# 🤖 AI Automatizace pro Inzerty

## Přehled funkcí

Tento dokument popisuje implementaci AI-powered automatizace pro autonomní práci se shodnými inzeráty.

---

## 📋 Obsah

1. [Autonomní komunikace s prodejci/kupujícími](#1-autonomní-komunikace-s-prodejci-kupujícími)
2. [Automatické vyjednávání cen](#2-automatické-vyjednávání-cen)
3. [AI rozhodování o prioritách](#3-ai-rozhodování-o-prioritách)
4. [Automatizované plánování předání](#4-automatizované-plánování-předání)
5. [Detekce podvodů a rizik](#5-detekce-podvodů-a-rizik)
6. [Automatické sledování stavu obchodu](#6-automatické-sledování-stavu-obchodu)

---

## 1. Autonomní komunikace s prodejci/kupujícími

### Popis
AI generuje personalizované zprávy na základě kontextu inzerátu a historie komunikace.

### Implementace

#### 1.1 AI Template Generator

```typescript
// backend/src/ai-messages.ts

interface MessageContext {
  match: MatchItem;
  side: 'seller' | 'buyer';
  channel: 'bazos' | 'sms' | 'email';
  previousMessages?: Message[];
  userStyle?: 'formal' | 'friendly' | 'direct';
}

const generateAIMessage = async (context: MessageContext): Promise<string> => {
  const prompt = `
Generuj přirozenou lidskou zprávu pro ${context.side === 'seller' ? 'prodávajícího' : 'kupujícího'}.

Kontext:
- Nabídka: ${context.match.offer.title} za ${context.match.offer.price}
- Poptávka: ${context.match.demand.title} za ${context.match.demand.price}
- Potenciální zisk: ${context.match.arbitrageScore} Kč
- Lokalita nabídky: ${context.match.offer.location}
- Lokalita poptávky: ${context.match.demand.location}

${context.previousMessages ? `
Historie komunikace:
${context.previousMessages.map(m => `- ${m.sender}: ${m.text}`).join('\n')}
` : ''}

Styl komunikace: ${context.userStyle || 'friendly'}

Požadavky:
- Zpráva musí znít lidsky, ne jako bot
- Nepoužívat fráze jako "Inzerty Bot", "automatizovaná zpráva"
- Být zdvořilý ale přímý
- Obsahovat konkrétní detaily z inzerátu
- ${context.side === 'seller' ? 'Nabídnout konkrétní telefon' : 'Vyjádřit zájem o konkrétní telefon'}
- Nezmiňovat osobní předání pokud to není nutné
- Maximálně 150 slov pro email, 50 pro SMS

Generuj pouze text zprávy bez předmětu.
  `;

  const response = await callOllama(prompt, 'llama3.2:1b');
  return response.text;
};
```

#### 1.2 Kontextová historie

```typescript
// Ukládání historie komunikace per match

interface Conversation {
  matchKey: string;
  messages: Message[];
  lastContactedAt: string;
  responseRate: number;
  averageResponseTime: number; // v hodinách
}

const saveMessage = async (matchKey: string, message: Message) => {
  await db.run(`
    INSERT INTO conversations (match_key, message, sender, sent_at)
    VALUES (?, ?, ?, ?)
  `, [matchKey, message.text, message.sender, new Date().toISOString()]);
  
  // Aktualizovat statistiky
  await updateConversationStats(matchKey);
};
```

---

## 2. Automatické vyjednávání cen

### Popis
AI navrhuje optimální nabídkové ceny na základě trhu, stavu zařízení a urgency.

### Implementace

#### 2.1 Price Negotiation Engine

```typescript
// backend/src/ai-negotiation.ts

interface NegotiationContext {
  offerPrice: number;
  demandPrice: number;
  marketAverage: number;
  deviceCondition?: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  daysOnMarket: number;
  sellerResponseRate?: number;
  urgency: 'low' | 'medium' | 'high';
}

const calculateOptimalOffer = async (ctx: NegotiationContext): Promise<{
  recommendedOffer: number;
  minAcceptable: number;
  maxOffer: number;
  reasoning: string;
}> => {
  const prompt = `
Analyzuj tuto obchodní situaci a navrhni optimální nabídku:

Data:
- Nabídková cena: ${ctx.offerPrice} Kč
- Poptávková cena: ${ctx.demandPrice} Kč
- Tržní průměr: ${ctx.marketAverage} Kč
- Stav zařízení: ${ctx.deviceCondition || 'neznámý'}
- Doba na trhu: ${ctx.daysOnMarket} dní
- Rychlost reakce prodejce: ${ctx.sellerResponseRate || 'neznámá'}%
- Urgence obchodu: ${ctx.urgency}

Požadavek:
1. Navrhni optimální nabídkovou cenu
2. Urči minimální přijatelnou cenu
3. Urči maximální cenu kterou nabídnout
4. Vysvětli reasoning

Formát odpovědi JSON:
{
  "recommendedOffer": number,
  "minAcceptable": number,
  "maxOffer": number,
  "reasoning": string,
  "confidenceScore": number (0-100)
}
  `;

  const response = await callOllama(prompt, 'llama3.2:1b');
  return JSON.parse(response.text);
};
```

#### 2.2 Auto-counteroffer

```typescript
// Automatické proti-nabídky

const handleCounterOffer = async (matchKey: string, sellerMessage: string) => {
  const match = await getMatch(matchKey);
  const currentOffer = match.offer.price;
  
  // Analyzovat sellerovu zprávu
  const analysis = await analyzeSellerMessage(sellerMessage);
  
  if (analysis.containsCounterOffer) {
    const counterPrice = extractPrice(sellerMessage);
    
    // Rozhodnout zda přijmout, odmítnout, nebo proti-nabídnout
    const decision = await makeCounterDecision({
      counterPrice,
      currentOffer,
      demandPrice: match.demand.price,
      minProfit: 1000, // minimální zisk
    });
    
    if (decision.action === 'accept') {
      return { action: 'accept', message: 'Dobrá, beru to.' };
    } else if (decision.action === 'reject') {
      return { action: 'reject', message: 'Děkuji, ale za tuto cenu to nemohu koupit.' };
    } else {
      const newOffer = decision.counterPrice;
      return {
        action: 'counter',
        price: newOffer,
        message: `Mohu nabídnout ${newOffer} Kč. Je to moje nejlepší nabídka.`
      };
    }
  }
};
```

---

## 3. AI rozhodování o prioritách

### Popis
AI automaticky určuje které obchody jsou nejvíce perspektivní a kam zaměřit úsilí.

### Implementace

#### 3.1 Opportunity Scoring 2.0

```typescript
// backend/src/ai-scoring.ts

interface AdvancedScoringContext {
  match: MatchItem;
  sellerHistory?: SellerStats;
  marketTrends: MarketTrend[];
  userCapacity: {
    maxActiveDeals: number;
    currentActiveDeals: number;
    preferredBrands: string[];
  };
}

const calculateAdvancedScore = async (ctx: AdvancedScoringContext): Promise<{
  overallScore: number; // 0-100
  components: {
    profitScore: number;
    trustScore: number;
    urgencyScore: number;
    marketScore: number;
    capacityScore: number;
  };
  recommendation: 'prioritize' | 'normal' | 'skip';
  reasoning: string;
}> => {
  const prompt = `
Ohodnoť tuto obchodní příležitost:

Obchod:
- Zisk: ${ctx.match.arbitrageScore} Kč
- Podobnost: ${ctx.match.similarityScore}%
- Oferta: ${ctx.match.offer.title} za ${ctx.match.offer.price}
- Poptávka: ${ctx.match.demand.title} za ${ctx.match.demand.price}

Prodejce:
${ctx.sellerHistory ? `
- Historie obchodů: ${ctx.sellerHistory.totalDeals}
- Úspěšnost: ${ctx.sellerHistory.successRate}%
- Průměrná doba reakce: ${ctx.sellerHistory.avgResponseTime}h
` : '- Žádná historie'}

Trh:
${ctx.marketTrends.map(t => `- ${t.brand}: ${t.trend} (${t.change}%)`).join('\n')}

Kapacita uživatele:
- Aktivní obchody: ${ctx.userCapacity.currentActiveDeals}/${ctx.userCapacity.maxActiveDeals}
- Preferované značky: ${ctx.userCapacity.preferredBrands.join(', ')}

Ohodnoť 0-100 a doporuč prioritu:
1. Profitabilita (váha 30%)
2. Důvěryhodnost (váha 25%)
3. Urgence (váha 20%)
4. Tržní trend (váha 15%)
5. Kapacita (váha 10%)

Formát odpovědi JSON:
{
  "overallScore": number,
  "components": {
    "profitScore": number,
    "trustScore": number,
    "urgencyScore": number,
    "marketScore": number,
    "capacityScore": number
  },
  "recommendation": "prioritize|normal|skip",
  "reasoning": string
}
  `;

  const response = await callOllama(prompt, 'llama3.2:1b');
  return JSON.parse(response.text);
};
```

#### 3.2 Auto-prioritization

```typescript
// Automatické řazení a filtrování

const prioritizeMatches = async (matches: MatchItem[]): Promise<PrioritizedMatch[]> => {
  const scored = await Promise.all(
    matches.map(async (match) => {
      const context: AdvancedScoringContext = {
        match,
        sellerHistory: await getSellerStats(match.offer.url),
        marketTrends: await getMarketTrends(match.offer.brand),
        userCapacity: await getUserCapacity(),
      };
      
      return {
        match,
        score: await calculateAdvancedScore(context),
      };
    })
  );
  
  // Seřadit podle skóre
  scored.sort((a, b) => b.score.overallScore - a.score.overallScore);
  
  // Doporučit top 3 k okamžité akci
  const topPriority = scored.filter(s => s.score.recommendation === 'prioritize').slice(0, 3);
  
  return {
    all: scored,
    topPriority,
    skip: scored.filter(s => s.score.recommendation === 'skip'),
  };
};
```

---

## 4. Automatizované plánování předání

### Popis
AI navrhuje optimální termíny a způsoby odeslání podle dostupnosti a preferencí.

### Implementace

#### 4.1 Meeting Scheduler

```typescript
// backend/src/ai-scheduler.ts

interface MeetingContext {
  offerLocation: string;
  demandLocation: string;
  userAvailability?: TimeSlot[];
  preferredMeetingPlaces?: string[];
  urgency: 'low' | 'medium' | 'high';
}

const suggestMeeting = async (ctx: MeetingContext): Promise<{
  suggestedPlaces: string[];
  suggestedTimes: string[];
  reasoning: string;
}> => {
  const prompt = `
Navrhni optimální místo a čas pro předání:

Lokality:
- Prodejce: ${ctx.offerLocation}
- Kupující: ${ctx.demandLocation}

${ctx.userAvailability ? `
Dostupnost kupujícího:
${ctx.userAvailability.map(s => `- ${s.day} ${s.time}`).join('\n')}
` : ''}

${ctx.preferredMeetingPlaces ? `
Preferovaná místa: ${ctx.preferredMeetingPlaces.join(', ')}
` : ''}

Urgence: ${ctx.urgency}

Požadavky:
1. Navrhni 3-5 veřejných míst (nákupní centra, nádraží, kavárny)
2. Navrhni 3 časové sloty
3. Zohledni vzdálenost pro obě strany
4. Doporuč bezpečná místa s dobrým spojením

Formát odpovědi JSON:
{
  "suggestedPlaces": [
    {"name": string, "address": string, "reason": string}
  ],
  "suggestedTimes": [
    {"datetime": string, "reason": string}
  ],
  "reasoning": string
}
  `;

  const response = await callOllama(prompt, 'llama3.2:1b');
  return JSON.parse(response.text);
};
```

#### 4.2 Calendar Integration

```typescript
// Integrace s kalendářem

const scheduleMeeting = async (matchKey: string, meeting: MeetingSuggestion) => {
  // Uložit do kalendáře
  await addToCalendar({
    title: `Předání: ${matchKey}`,
    location: meeting.place.address,
    start: meeting.time.datetime,
    end: addHours(meeting.time.datetime, 1),
    notes: meeting.reasoning,
  });
  
  // Odeslat pozvánku oběma stranám
  await sendMeetingInvitation(matchKey, meeting);
  
  // Nastavit reminder
  await setReminder({
    matchKey,
    time: subHours(meeting.time.datetime, 2),
    message: `Připomínka: Předání za 2 hodiny na ${meeting.place.name}`,
  });
};
```

---

## 5. Detekce podvodů a rizik

### Popis
AI analyzuje inzeráty a komunikaci na známky podvodů, rizikových vzorců a problémů.

### Implementace

#### 5.1 Fraud Detection

```typescript
// backend/src/ai-fraud-detection.ts

interface FraudAnalysisResult {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  flags: RiskFlag[];
  recommendation: string;
}

interface RiskFlag {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: string;
}

const analyzeFraudRisk = async (match: MatchItem, conversation?: Message[]): Promise<FraudAnalysisResult> => {
  const prompt = `
Analyzuj tento obchod na známky podvodu nebo rizika:

Inzerát nabídky:
- Titulek: ${match.offer.title}
- Cena: ${match.offer.price} Kč
- Popis: ${match.offer.description}
- Lokalita: ${match.offer.location}
- URL: ${match.offer.url}

Inzerát poptávky:
- Titulek: ${match.demand.title}
- Cena: ${match.demand.price} Kč
- Lokalita: ${match.demand.location}

${conversation ? `
Komunikace:
${conversation.map(m => `- ${m.sender}: ${m.text}`).join('\n')}
` : ''}

Hledej tyto red flags:
1. Podezřele nízká cena (výrazně pod tržní)
2. Tlak na rychlost ("ihned", "dnes", "spěchá")
3. Odmítání osobního předání
4. Požadavek na platbu předem
5. Podezřelý jazyk (gramatické chyby, generické texty)
6. Chybějící detaily o zařízení
7. Prodejce z jiné země
8. Požadavek na soukromé údaje
9. Příliš dobrá nabídka
10. Nekonzistence v komunikaci

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

  const response = await callOllama(prompt, 'llama3.2:1b');
  return JSON.parse(response.text);
};
```

#### 5.2 Auto-blocklist

```typescript
// Automatické přidávání na blacklist

const handleHighRiskMatch = async (matchKey: string, analysis: FraudAnalysisResult) => {
  if (analysis.riskLevel === 'critical' || analysis.riskLevel === 'high') {
    // Automaticky označit jako rizikový
    await markMatchAsRisky(matchKey, analysis);
    
    // Přidat prodejce na watchlist
    const sellerUrl = extractSellerIdentifier(matchKey);
    await addToWatchlist(sellerUrl, {
      reason: analysis.flags.map(f => f.description).join('; '),
      riskScore: analysis.riskScore,
      date: new Date().toISOString(),
    });
    
    // Upozornit uživatele
    await sendRiskAlert({
      matchKey,
      riskLevel: analysis.riskLevel,
      flags: analysis.flags,
      recommendation: analysis.recommendation,
    });
  }
};
```

---

## 6. Automatické sledování stavu obchodu

### Popis
AI sleduje průběh obchodu, automaticky follow-upuje a aktualizuje status.

### Implementace

#### 6.1 State Machine

```typescript
// backend/src/deal-states.ts

enum DealState {
  NEW = 'new',
  CONTACTED = 'contacted',
  NEGOTIATING = 'negotiating',
  AGREED = 'agreed',
  MEETING_SCHEDULED = 'meeting_scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  STALLED = 'stalled',
}

interface DealStateTransition {
  from: DealState;
  to: DealState;
  trigger: string;
  autoActions: AutoAction[];
}

const stateTransitions: DealStateTransition[] = [
  {
    from: DealState.NEW,
    to: DealState.CONTACTED,
    trigger: 'message_sent',
    autoActions: [
      { type: 'schedule_followup', delay: '24h' },
      { type: 'log_activity', message: 'První kontakt odeslán' },
    ],
  },
  {
    from: DealState.CONTACTED,
    to: DealState.STALLED,
    trigger: 'no_response_48h',
    autoActions: [
      { type: 'send_followup', template: 'gentle_reminder' },
      { type: 'decrease_priority', amount: 20 },
    ],
  },
  {
    from: DealState.NEGOTIATING,
    to: DealState.AGREED,
    trigger: 'price_accepted',
    autoActions: [
      { type: 'schedule_meeting', prompt: true },
      { type: 'send_confirmation', template: 'deal_confirmed' },
    ],
  },
  {
    from: DealState.MEETING_SCHEDULED,
    to: DealState.COMPLETED,
    trigger: 'meeting_confirmed',
    autoActions: [
      { type: 'calculate_profit', final: true },
      { type: 'request_feedback', delay: '1h' },
      { type: 'update_seller_stats', success: true },
    ],
  },
];
```

#### 6.2 Auto Follow-up

```typescript
// backend/src/auto-followup.ts

const checkStalledDeals = async () => {
  const stalledDeals = await db.all(`
    SELECT m.*, c.last_message_at
    FROM matches m
    LEFT JOIN conversations c ON c.match_key = m.match_key
    WHERE m.state IN ('contacted', 'negotiating')
    AND c.last_message_at < datetime('now', '-48 hours')
  `);
  
  for (const deal of stalledDeals) {
    const daysSinceContact = daysSince(deal.last_message_at);
    
    if (daysSinceContact >= 7) {
      // Po 7 dnech označit jako stalled
      await updateDealState(deal.match_key, DealState.STALLED);
      await notifyUser({
        type: 'deal_stalled',
        match: deal,
        message: `Obchod neaktivní ${daysSinceContact} dní. Označeno jako neaktivní.`,
      });
    } else if (daysSinceContact >= 2) {
      // Po 2 dnech poslat follow-up
      const followupMessage = await generateFollowupMessage({
        match: deal,
        daysSinceContact,
        previousAttempts: await getFollowupHistory(deal.match_key),
      });
      
      await sendMessage(deal.match_key, followupMessage);
      await logFollowup(deal.match_key, {
        sentAt: new Date().toISOString(),
        message: followupMessage,
        attemptNumber: daysSinceContact - 1,
      });
    }
  }
};

// Spouštět každou hodinu
cron.schedule('0 * * * *', checkStalledDeals);
```

#### 6.3 Progress Tracking Dashboard

```typescript
// Frontend komponenta pro sledování

interface DealPipeline {
  state: DealState;
  count: number;
  totalValue: number;
  avgDaysInState: number;
  deals: MatchItem[];
}

const PipelineDashboard: React.FC = () => {
  const [pipeline, setPipeline] = useState<DealPipeline[]>([]);
  
  useEffect(() => {
    const fetchPipeline = async () => {
      const data = await fetch('/api/deals/pipeline');
      setPipeline(await data.json());
    };
    
    fetchPipeline();
    const interval = setInterval(fetchPipeline, 60000); // Refresh každou minutu
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="pipeline-dashboard">
      {pipeline.map(stage => (
        <PipelineStage
          key={stage.state}
          stage={stage}
          onDealClick={(deal) => openDealDetail(deal)}
        />
      ))}
      
      <AutomationControls
        onEnableAutoFollowup={() => enableAutoFollowup()}
        onEnableFraudDetection={() => enableFraudDetection()}
        onEnableAutoNegotiation={() => enableAutoNegotiation()}
      />
    </div>
  );
};
```

---

## 🚀 Implementační plán

### Fáze 1: Základy (Týden 1-2)
- [ ] Implementovat AI message generator
- [ ] Ukládání historie komunikace
- [ ] Základní scoring s AI

### Fáze 2: Automatizace (Týden 3-4)
- [ ] Auto follow-up systém
- [ ] State machine pro deal tracking
- [ ] Calendar integration

### Fáze 3: Pokročilé funkce (Týden 5-6)
- [ ] Fraud detection
- [ ] Auto negotiation engine
- [ ] Meeting scheduler

### Fáze 4: Optimalizace (Týden 7-8)
- [ ] UI pro automation controls
- [ ] Performance tuning
- [ ] Testing a bug fixes

---

## ⚠️ Bezpečnostní upozornění

1. **Vždy vyžadovat potvrzení uživatele** pro:
   - Odeslání finální nabídky
   - Souhlas s cenou
   - Plánování setkání

2. **Nikdy neodesílat automaticky**:
   - Citlivé údaje (telefon, email, adresa)
   - Platební informace
   - Identifikační údaje

3. **Logovat všechny AI akce** pro audit a debugging

4. **Umožnit uživateli přepsat** jakékoli AI rozhodnutí

---

## 📊 Metriky úspěšnosti

| Metrika | Cíl | Měření |
|---------|-----|--------|
| Response rate | >80% | % odpovědí na zprávy |
| Deal completion rate | >60% | % úspěšných obchodů |
| Avg time to close | <7 dní | Průměrná doba obchodu |
| Fraud detection accuracy | >95% | % správně detekovaných podvodů |
| User satisfaction | >4/5 | Feedback od uživatelů |

---

## 🔧 Technické požadavky

- **Ollama model**: `llama3.2:1b` (nebo lepší pokud dostupný)
- **Database**: PostgreSQL s pgvector pro embeddingy
- **Cron**: Pro pravidelné follow-upy a kontrolu stavů
- **Rate limiting**: Max 10 AI volání za minutu
- **Cache**: Ukládat AI odpovědi pro opakující se scénáře

---

*Dokument vytvořen: 2026-03-12*
*Poslední aktualizace: 2026-03-12*
