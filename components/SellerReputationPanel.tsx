import React, { useEffect, useState } from 'react';

interface SellerReputation {
  seller_identifier: string;
  total_transactions: number;
  successful_transactions: number;
  failed_transactions: number;
  avg_response_time_hours: number;
  fraud_flags_count: number;
  reputation_score: number;
  last_transaction_at?: string;
}

interface SellerReputationPanelProps {
  sellerId?: string;
}

const SellerReputationPanel: React.FC<SellerReputationPanelProps> = ({ sellerId }) => {
  const [reputation, setReputation] = useState<SellerReputation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sellerId) {
      loadReputation();
    }
  }, [sellerId]);

  const loadReputation = async () => {
    try {
      const response = await fetch(`http://localhost:3001/fraud/seller-reputation/${sellerId}`);
      if (response.ok) {
        const data = await response.json();
        setReputation(data.reputation);
      }
    } catch (error) {
      console.error('Chyba při načítání reputace:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReputationLevel = (score: number) => {
    if (score >= 80) return { level: 'Výborná', color: 'text-emerald-400', bg: 'bg-emerald-900 bg-opacity-20' };
    if (score >= 60) return { level: 'Dobrá', color: 'text-blue-400', bg: 'bg-blue-900 bg-opacity-20' };
    if (score >= 40) return { level: 'Průměrná', color: 'text-yellow-400', bg: 'bg-yellow-900 bg-opacity-20' };
    if (score >= 20) return { level: 'Špatná', color: 'text-orange-400', bg: 'bg-orange-900 bg-opacity-20' };
    return { level: 'Velmi špatná', color: 'text-red-400', bg: 'bg-red-900 bg-opacity-20' };
  };

  if (loading || !sellerId) {
    return <div className="text-slate-400">Načítám reputaci prodejce...</div>;
  }

  if (!reputation) {
    return (
      <div className="text-center py-8 text-slate-400">
        <div className="text-4xl mb-3">❓</div>
        <div>Žádná data o prodejci</div>
        <div className="text-sm mt-2">Prodejce zatím nemá žádné transakce</div>
      </div>
    );
  }

  const repLevel = getReputationLevel(reputation.reputation_score);

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
      <h3 className="text-lg font-semibold text-sky-400 flex items-center gap-2">
        <span>🏆</span>
        Reputace prodejce
      </h3>

      {/* Reputation Score */}
      <div className={`p-4 rounded-lg border-2 ${repLevel.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400">Skóre reputace</div>
            <div className={`text-3xl font-bold ${repLevel.color}`}>
              {Math.round(reputation.reputation_score)}
              <span className="text-sm text-slate-500">/100</span>
            </div>
          </div>
          <div className={`text-lg font-medium ${repLevel.color}`}>
            {repLevel.level}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="text-xs text-slate-400">Celkem transakcí</div>
          <div className="text-xl font-bold text-white">{reputation.total_transactions}</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="text-xs text-slate-400">Úspěšných</div>
          <div className="text-xl font-bold text-emerald-400">{reputation.successful_transactions}</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="text-xs text-slate-400">Neúspěšných</div>
          <div className="text-xl font-bold text-red-400">{reputation.failed_transactions}</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="text-xs text-slate-400">Prům. čas odpovědi</div>
          <div className="text-xl font-bold text-blue-400">
            {Math.round(reputation.avg_response_time_hours)}h
          </div>
        </div>
      </div>

      {/* Fraud Flags */}
      {reputation.fraud_flags_count > 0 && (
        <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-400">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="font-medium">Detekováno rizikových faktorů</div>
              <div className="text-sm">{reputation.fraud_flags_count}</div>
            </div>
          </div>
        </div>
      )}

      {/* Success Rate */}
      {reputation.total_transactions > 0 && (
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-400">Úspěšnost transakcí</span>
            <span className="text-emerald-400 font-medium">
              {Math.round((reputation.successful_transactions / reputation.total_transactions) * 100)}%
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div
              className="h-3 rounded-full bg-emerald-500 transition-all"
              style={{ 
                width: `${(reputation.successful_transactions / reputation.total_transactions) * 100}%` 
              }}
            ></div>
          </div>
        </div>
      )}

      {/* Last Transaction */}
      {reputation.last_transaction_at && (
        <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-700">
          Poslední transakce: {new Date(reputation.last_transaction_at).toLocaleString('cs-CZ')}
        </div>
      )}
    </div>
  );
};

export default SellerReputationPanel;
