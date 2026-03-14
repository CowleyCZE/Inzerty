import React, { useState } from 'react';

interface NegotiationInterfaceProps {
  matchKey: string;
  offerPrice: number;
  demandPrice: number;
  minProfit?: number;
  onNegotiationComplete?: (result: {
    action: 'accept' | 'reject' | 'counter';
    counterPrice?: number;
    message: string;
  }) => void;
}

const NegotiationInterface: React.FC<NegotiationInterfaceProps> = ({
  matchKey,
  offerPrice,
  demandPrice,
  minProfit = 1000,
  onNegotiationComplete,
}) => {
  const [counterPrice, setCounterPrice] = useState<number | ''>('');
  const [optimalOffer, setOptimalOffer] = useState<{
    recommendedOffer: number;
    minAcceptable: number;
    maxOffer: number;
    reasoning: string;
    confidenceScore: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [negotiationHistory, setNegotiationHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const calculateOptimalOffer = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/negotiation/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerPrice,
          demandPrice,
          minProfit,
          marketAverage: (offerPrice + demandPrice) / 2,
          urgency: 'medium',
          daysOnMarket: 7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setOptimalOffer(data);
      }
    } catch (error) {
      console.error('Error calculating optimal offer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCounterOffer = async () => {
    if (!counterPrice) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/negotiation/counter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentOffer: offerPrice,
          counterPrice: Number(counterPrice),
          demandPrice,
          minProfit,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onNegotiationComplete?.(data);

        // Save to history
        await fetch('http://localhost:3001/negotiation/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchKey,
            offerPrice,
            counterPrice: Number(counterPrice),
            finalPrice: data.action === 'accept' ? Number(counterPrice) : undefined,
            status: data.action === 'accept' ? 'accepted' : data.action === 'reject' ? 'rejected' : 'pending',
            aiSuggested: false,
          }),
        });

        setNegotiationHistory(prev => [...prev, {
          counterPrice: Number(counterPrice),
          result: data,
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (error) {
      console.error('Error generating counter offer:', error);
    } finally {
      setLoading(false);
    }
  };

  const spread = demandPrice - offerPrice;
  const maxAcceptable = demandPrice - minProfit;
  const profitPercent = ((demandPrice - offerPrice) / offerPrice * 100).toFixed(1);

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
      <h3 className="text-lg font-semibold text-sky-400 flex items-center gap-2">
        <span>💰</span>
        Vyjednávání cen
      </h3>

      {/* Price Overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="text-xs text-slate-400">Nabídka</div>
          <div className="text-xl font-bold text-green-400">{offerPrice.toLocaleString()} Kč</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="text-xs text-slate-400">Poptávka</div>
          <div className="text-xl font-bold text-blue-400">{demandPrice.toLocaleString()} Kč</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="text-xs text-slate-400">Zisk</div>
          <div className="text-xl font-bold text-emerald-400">
            {spread.toLocaleString()} Kč ({profitPercent}%)
          </div>
        </div>
      </div>

      {/* Profit Analysis */}
      <div className="bg-slate-900 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Analýza zisku</span>
          <span className={`text-xs font-medium ${spread >= minProfit ? 'text-green-400' : 'text-red-400'}`}>
            {spread >= minProfit ? '✅ Nad minimem' : '❌ Pod minimem'}
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${spread >= minProfit ? 'bg-green-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(100, (spread / minProfit) * 100)}%` }}
          ></div>
        </div>
        <div className="flex justify-between mt-1 text-xs text-slate-500">
          <span>0 Kč</span>
          <span>Min: {minProfit.toLocaleString()} Kč</span>
          <span>Max: {maxAcceptable.toLocaleString()} Kč</span>
        </div>
      </div>

      {/* AI Optimal Offer */}
      <div className="border border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-300">🤖 AI doporučení</span>
          <button
            onClick={calculateOptimalOffer}
            disabled={loading}
            className="px-3 py-1 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 text-white rounded text-xs font-medium transition-colors"
          >
            {loading ? 'Počítám...' : 'Spočítat'}
          </button>
        </div>

        {optimalOffer && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-800 rounded p-2">
                <div className="text-xs text-slate-400">Doporučeno</div>
                <div className="text-lg font-bold text-sky-400">
                  {optimalOffer.recommendedOffer.toLocaleString()} Kč
                </div>
              </div>
              <div className="bg-slate-800 rounded p-2">
                <div className="text-xs text-slate-400">Minimum</div>
                <div className="text-lg font-bold text-green-400">
                  {optimalOffer.minAcceptable.toLocaleString()} Kč
                </div>
              </div>
              <div className="bg-slate-800 rounded p-2">
                <div className="text-xs text-slate-400">Maximum</div>
                <div className="text-lg font-bold text-orange-400">
                  {optimalOffer.maxOffer.toLocaleString()} Kč
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-400">
              <strong>Reasoning:</strong> {optimalOffer.reasoning}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Confidence:</span>
              <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-purple-500"
                  style={{ width: `${optimalOffer.confidenceScore}%` }}
                ></div>
              </div>
              <span className="text-xs text-purple-400">{optimalOffer.confidenceScore}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Counter Offer Input */}
      <div className="border border-slate-700 rounded-lg p-4">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Protinabídka prodejce (Kč)
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={counterPrice}
            onChange={(e) => setCounterPrice(e.target.value ? Number(e.target.value) : '')}
            placeholder="Zadejte protinabídku..."
            className="flex-1 bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500"
          />
          <button
            onClick={handleCounterOffer}
            disabled={loading || !counterPrice}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            Vyhodnotit
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          Maximální akceptovatelná cena: <span className="text-orange-400 font-medium">{maxAcceptable.toLocaleString()} Kč</span>
          {' '}({minProfit.toLocaleString()} Kč zisk)
        </div>
      </div>

      {/* Negotiation History Toggle */}
      {negotiationHistory.length > 0 && (
        <div className="border border-slate-700 rounded-lg">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-4 py-2 text-left text-sm font-medium text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
          >
            📜 Historie vyjednávání ({negotiationHistory.length})
          </button>
          {showHistory && (
            <div className="px-4 pb-4 space-y-2">
              {negotiationHistory.map((item, idx) => (
                <div key={idx} className="text-xs text-slate-400 bg-slate-900 rounded p-2">
                  <div className="flex items-center justify-between">
                    <span>Protinabídka: {item.counterPrice.toLocaleString()} Kč</span>
                    <span className={`font-medium ${
                      item.result.action === 'accept' ? 'text-green-400' :
                      item.result.action === 'reject' ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {item.result.action === 'accept' ? '✅ Přijmout' :
                       item.result.action === 'reject' ? '❌ Odmítnout' : '💬 Counter'}
                    </span>
                  </div>
                  <div className="text-slate-500 mt-1">{item.result.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NegotiationInterface;
