import React, { useState } from 'react';

interface MeetingSuggestion {
  place: {
    name: string;
    address: string;
    type: 'cafe' | 'mall' | 'station' | 'public';
    safety: number; // 0-100
  };
  time: {
    datetime: string;
    dayPart: 'morning' | 'afternoon' | 'evening';
    isWeekend: boolean;
  };
  reasoning: string;
}

interface MeetingSchedulerProps {
  matchKey: string;
  offerLocation?: string;
  demandLocation?: string;
  onScheduleMeeting?: (suggestion: MeetingSuggestion) => void;
}

const MeetingScheduler: React.FC<MeetingSchedulerProps> = ({
  matchKey,
  offerLocation,
  demandLocation,
  onScheduleMeeting,
}) => {
  const [suggestions, setSuggestions] = useState<MeetingSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<MeetingSuggestion | null>(null);
  const [scheduled, setScheduled] = useState(false);

  const generateSuggestions = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/meeting/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchKey,
          offerLocation,
          demandLocation,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (suggestion: MeetingSuggestion) => {
    setSelectedSuggestion(suggestion);
  };

  const handleConfirm = async () => {
    if (!selectedSuggestion) return;

    try {
      const response = await fetch('http://localhost:3001/meeting/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchKey,
          suggestion: selectedSuggestion,
        }),
      });

      if (response.ok) {
        setScheduled(true);
        onScheduleMeeting?.(selectedSuggestion);
      }
    } catch (error) {
      console.error('Error scheduling meeting:', error);
    }
  };

  const getSafetyColor = (safety: number) => {
    if (safety >= 80) return 'text-emerald-400';
    if (safety >= 60) return 'text-blue-400';
    if (safety >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSafetyLabel = (safety: number) => {
    if (safety >= 80) return '🟢 Velmi bezpečné';
    if (safety >= 60) return '🔵 Bezpečné';
    if (safety >= 40) return '🟡 Střední';
    return '🔴 Méně bezpečné';
  };

  const getPlaceIcon = (type: string) => {
    switch (type) {
      case 'cafe': return '☕';
      case 'mall': return '🛍️';
      case 'station': return '🚉';
      default: return '📍';
    }
  };

  const getDayPartLabel = (dayPart: string) => {
    switch (dayPart) {
      case 'morning': return '🌅 Dopoledne';
      case 'afternoon': return '☀️ Odpoledne';
      case 'evening': return '🌆 Večer';
      default: return dayPart;
    }
  };

  if (scheduled) {
    return (
      <div className="bg-emerald-900 bg-opacity-20 border border-emerald-700 rounded-xl p-6">
        <div className="text-center">
          <div className="text-3xl mb-2">✅</div>
          <h3 className="text-lg font-semibold text-emerald-400 mb-2">
            Schůzka naplánována!
          </h3>
          {selectedSuggestion && (
            <div className="text-sm text-emerald-200 space-y-1">
              <div><strong>Místo:</strong> {selectedSuggestion.place.name}</div>
              <div><strong>Adresa:</strong> {selectedSuggestion.place.address}</div>
              <div>
                <strong>Čas:</strong> {new Date(selectedSuggestion.time.datetime).toLocaleString('cs-CZ')}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-sky-400 flex items-center gap-2">
          <span>📅</span>
          Naplánovat předání
        </h3>
        <button
          onClick={generateSuggestions}
          disabled={loading}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
        >
          {loading ? '🔄 Generuji...' : '✨ AI Návrhy'}
        </button>
      </div>

      {/* Locations Info */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="text-xs text-slate-400">📍 Nabídka</div>
          <div className="text-slate-200">{offerLocation || 'Neznámá'}</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="text-xs text-slate-400">📍 Poptávka</div>
          <div className="text-slate-200">{demandLocation || 'Neznámá'}</div>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-300">Vyberte návrh:</h4>
          <div className="space-y-2">
            {suggestions.map((suggestion, idx) => (
              <div
                key={idx}
                onClick={() => handleSelect(suggestion)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedSuggestion === suggestion
                    ? 'bg-sky-900 bg-opacity-30 border-sky-600'
                    : 'bg-slate-900 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getPlaceIcon(suggestion.place.type)}</span>
                    <div>
                      <div className="font-medium text-slate-200">{suggestion.place.name}</div>
                      <div className="text-xs text-slate-400">{suggestion.place.address}</div>
                    </div>
                  </div>
                  <div className={`text-xs font-medium ${getSafetyColor(suggestion.place.safety)}`}>
                    {getSafetyLabel(suggestion.place.safety)}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-slate-300">
                  <div className="flex items-center gap-1">
                    <span>🕐</span>
                    <span>{getDayPartLabel(suggestion.time.dayPart)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>📆</span>
                    <span>{suggestion.time.isWeekend ? 'Víkend' : 'Pracovní den'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>🗓️</span>
                    <span>{new Date(suggestion.time.datetime).toLocaleDateString('cs-CZ')}</span>
                  </div>
                </div>

                {suggestion.reasoning && (
                  <div className="mt-2 text-xs text-slate-400 italic">
                    🤖 {suggestion.reasoning}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Confirm Button */}
          {selectedSuggestion && (
            <div className="flex justify-end pt-4">
              <button
                onClick={handleConfirm}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
              >
                ✅ Potvrdit schůzku
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {suggestions.length === 0 && !loading && (
        <div className="text-center py-8 text-slate-400">
          <div className="text-4xl mb-3">📍</div>
          <div>Klikněte na "✨ AI Návrhy" pro generování míst a časů</div>
          <div className="text-sm mt-2">AI navrhne optimální místa na základě lokalit</div>
        </div>
      )}
    </div>
  );
};

export default MeetingScheduler;
