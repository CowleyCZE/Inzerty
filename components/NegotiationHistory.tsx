import React, { useEffect, useState } from 'react';

interface NegotiationMessage {
  id: number;
  match_key: string;
  message: string;
  sender: 'user' | 'counterpart';
  channel: 'bazos' | 'sms' | 'email';
  sent_at: string;
  is_ai_generated: boolean;
  analysis?: {
    contains_counter_offer: boolean;
    extracted_price?: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    urgency: 'low' | 'medium' | 'high';
  };
}

interface AutoNegotiationLog {
  id: number;
  match_key: string;
  action: 'accept' | 'reject' | 'counter' | 'manual_review';
  counter_price?: number;
  message: string;
  ai_suggested: boolean;
  created_at: string;
}

interface NegotiationHistoryProps {
  matchKey?: string;
  onManualOverride?: (matchKey: string, action: 'accept' | 'reject' | 'counter', price?: number) => void;
}

const NegotiationHistory: React.FC<NegotiationHistoryProps> = ({ matchKey, onManualOverride }) => {
  const [messages, setMessages] = useState<NegotiationMessage[]>([]);
  const [logs, setLogs] = useState<AutoNegotiationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [matchKey]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      // Load messages
      const messagesRes = await fetch('http://localhost:3001/conversations/history');
      if (messagesRes.ok) {
        const data = await messagesRes.json();
        setMessages(data.history || []);
      }

      // Load negotiation logs
      const logsRes = await fetch('http://localhost:3001/negotiation/logs');
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeMessage = async (messageId: number, messageText: string) => {
    setAnalyzing(true);
    try {
      const response = await fetch('http://localhost:3001/negotiation/analyze-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          message: messageText,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Refresh history to show analysis
        loadHistory();
        return data.analysis;
      }
    } catch (error) {
      console.error('Error analyzing message:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAutoNegotiate = async (matchKey: string, counterPrice: number) => {
    try {
      const response = await fetch('http://localhost:3001/negotiation/auto-counter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchKey,
          counterPrice,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Auto-negotiation: ${data.action}\n${data.message}`);
        loadHistory();
      }
    } catch (error) {
      alert('❌ Chyba při auto-negotiation');
    }
  };

  if (loading) {
    return <div className="text-slate-400">Načítám historii vyjednávání...</div>;
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-sky-400 flex items-center gap-2">
          <span>💬</span>
          Historie vyjednávání
        </h2>
        <button
          onClick={loadHistory}
          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          🔄 Obnovit
        </button>
      </div>

      {/* Messages Timeline */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-slate-300">Zprávy</h3>
        <div className="space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-4 rounded-lg border ${
                msg.sender === 'user'
                  ? 'bg-sky-900 bg-opacity-20 border-sky-700'
                  : 'bg-emerald-900 bg-opacity-20 border-emerald-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    msg.sender === 'user' ? 'bg-sky-600 text-white' : 'bg-emerald-600 text-white'
                  }`}>
                    {msg.sender === 'user' ? 'My' : 'Prodejce'}
                  </span>
                  <span className="text-xs text-slate-400">{msg.channel}</span>
                  {msg.is_ai_generated && (
                    <span className="text-xs text-purple-400">🤖 AI</span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(msg.sent_at).toLocaleString('cs-CZ')}
                </div>
              </div>

              <div className="text-sm text-slate-200 mb-2">{msg.message}</div>

              {/* Analysis Results */}
              {msg.analysis && (
                <div className="bg-slate-900 rounded p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Analýza:</span>
                    {msg.analysis.contains_counter_offer ? (
                      <span className="text-emerald-400 font-medium">✅ Obsahuje counter-offer</span>
                    ) : (
                      <span className="text-slate-400">Žádný counter-offer</span>
                    )}
                  </div>
                  {msg.analysis.extracted_price && (
                    <div className="text-emerald-300">
                      💰 Extrahovaná cena: {msg.analysis.extracted_price.toLocaleString()} Kč
                    </div>
                  )}
                  <div className="flex gap-4">
                    <div>
                      <span className="text-slate-400">Sentiment:</span>{' '}
                      <span className={`font-medium ${
                        msg.analysis.sentiment === 'positive' ? 'text-green-400' :
                        msg.analysis.sentiment === 'negative' ? 'text-red-400' : 'text-yellow-400'
                      }`}>
                        {msg.analysis.sentiment === 'positive' ? '😊 Pozitivní' :
                         msg.analysis.sentiment === 'negative' ? '😠 Negativní' : '😐 Neutrální'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Urgence:</span>{' '}
                      <span className={`font-medium ${
                        msg.analysis.urgency === 'high' ? 'text-red-400' :
                        msg.analysis.urgency === 'medium' ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {msg.analysis.urgency === 'high' ? '🔴 Vysoká' :
                         msg.analysis.urgency === 'medium' ? '🟡 Střední' : '🟢 Nízká'}
                      </span>
                    </div>
                  </div>

                  {/* Auto-negotiate Button */}
                  {msg.sender === 'counterpart' && msg.analysis.contains_counter_offer && msg.analysis.extracted_price && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-slate-700">
                      <button
                        onClick={() => handleAutoNegotiate(msg.match_key, msg.analysis!.extracted_price!)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors"
                      >
                        🤖 Auto-negotiate
                      </button>
                      <button
                        onClick={() => analyzeMessage(msg.id, msg.message)}
                        disabled={analyzing}
                        className="px-3 py-1 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 text-white rounded text-xs font-medium transition-colors"
                      >
                        {analyzing ? 'Analyzuji...' : '🔍 Analyzovat'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Analyze Button (if not analyzed) */}
              {!msg.analysis && msg.sender === 'counterpart' && (
                <button
                  onClick={() => analyzeMessage(msg.id, msg.message)}
                  disabled={analyzing}
                  className="mt-2 px-3 py-1 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 text-white rounded text-xs font-medium transition-colors"
                >
                  {analyzing ? 'Analyzuji...' : '🔍 Analyzovat zprávu'}
                </button>
              )}
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              Žádné zprávy k zobrazení
            </div>
          )}
        </div>
      </div>

      {/* Negotiation Logs */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-slate-300">Auto-negotiation Log</h3>
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`p-4 rounded-lg border ${
                log.action === 'accept' ? 'bg-green-900 bg-opacity-20 border-green-700' :
                log.action === 'reject' ? 'bg-red-900 bg-opacity-20 border-red-700' :
                log.action === 'counter' ? 'bg-yellow-900 bg-opacity-20 border-yellow-700' :
                'bg-slate-900 bg-opacity-20 border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    log.action === 'accept' ? 'bg-green-600 text-white' :
                    log.action === 'reject' ? 'bg-red-600 text-white' :
                    log.action === 'counter' ? 'bg-yellow-600 text-white' :
                    'bg-slate-600 text-white'
                  }`}>
                    {log.action === 'accept' ? '✅ Přijmuto' :
                     log.action === 'reject' ? '❌ Odmítnuto' :
                     log.action === 'counter' ? '💬 Counter' : '⚠️ Manual Review'}
                  </span>
                  {log.ai_suggested && (
                    <span className="text-xs text-purple-400">🤖 AI</span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(log.created_at).toLocaleString('cs-CZ')}
                </div>
              </div>

              <div className="text-sm text-slate-200">{log.message}</div>
              {log.counter_price && (
                <div className="text-xs text-emerald-400 mt-1">
                  Counter cena: {log.counter_price.toLocaleString()} Kč
                </div>
              )}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              Žádné auto-negotiation logy
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NegotiationHistory;
