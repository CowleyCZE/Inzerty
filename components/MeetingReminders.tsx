import React, { useEffect, useState } from 'react';

interface ScheduledMeeting {
  id: number;
  matchKey: string;
  place: {
    name: string;
    address: string;
    type: string;
  };
  datetime: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  reminderSent: boolean;
  createdAt: string;
}

interface MeetingRemindersProps {
  onReminderSent?: (matchKey: string) => void;
}

const MeetingReminders: React.FC<MeetingRemindersProps> = ({ onReminderSent }) => {
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('upcoming');

  useEffect(() => {
    loadMeetings();
    const interval = setInterval(loadMeetings, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadMeetings = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/meetings/list');
      if (response.ok) {
        const data = await response.json();
        setMeetings(data.meetings || []);
      }
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (matchKey: string) => {
    try {
      const response = await fetch('http://localhost:3001/meeting/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchKey }),
      });

      if (response.ok) {
        onReminderSent?.(matchKey);
        loadMeetings();
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
    }
  };

  const cancelMeeting = async (matchKey: string) => {
    if (!confirm('Opravdu chcete zrušit tuto schůzku?')) return;

    try {
      const response = await fetch(`http://localhost:3001/meeting/cancel/${matchKey}`, {
        method: 'POST',
      });

      if (response.ok) {
        loadMeetings();
      }
    } catch (error) {
      console.error('Error canceling meeting:', error);
    }
  };

  const markCompleted = async (matchKey: string) => {
    try {
      const response = await fetch(`http://localhost:3001/meeting/complete/${matchKey}`, {
        method: 'POST',
      });

      if (response.ok) {
        loadMeetings();
      }
    } catch (error) {
      console.error('Error marking completed:', error);
    }
  };

  const filteredMeetings = meetings.filter(m => {
    if (filter === 'upcoming') {
      return new Date(m.datetime) > new Date() && m.status !== 'completed';
    }
    if (filter === 'completed') {
      return m.status === 'completed';
    }
    return true;
  });

  const upcomingMeetings = meetings.filter(m => 
    new Date(m.datetime) > new Date() && m.status !== 'completed' && m.status !== 'cancelled'
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-600';
      case 'confirmed': return 'bg-emerald-600';
      case 'completed': return 'bg-slate-600';
      case 'cancelled': return 'bg-red-600';
      default: return 'bg-slate-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return '📅 Naplánováno';
      case 'confirmed': return '✅ Potvrzeno';
      case 'completed': return '✔️ Dokončeno';
      case 'cancelled': return '❌ Zrušeno';
      default: return status;
    }
  };

  const getTimeUntilMeeting = (datetime: string) => {
    const now = new Date();
    const meeting = new Date(datetime);
    const diffMs = meeting.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 0) return 'Po termínu';
    if (diffHours < 1) return 'Za méně než hodinu';
    if (diffHours < 24) return `Za ${diffHours}h`;
    return `Za ${diffDays}d`;
  };

  if (loading) {
    return <div className="text-slate-400">Načítám schůzky...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-sky-400 flex items-center gap-2">
          <span>📅</span>
          Naplánovaná předání
        </h2>
        {upcomingMeetings.length > 0 && (
          <div className="px-3 py-1 bg-amber-600 text-white rounded-full text-sm font-medium">
            ⏰ {upcomingMeetings.length} nadcházejících
          </div>
        )}
      </div>

      {/* Filter Controls */}
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">Filtr:</span>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'all' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300'}`}
        >
          Všechny
        </button>
        <button
          onClick={() => setFilter('upcoming')}
          className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'upcoming' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'}`}
        >
          Nadcházející
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'completed' ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-300'}`}
        >
          Dokončené
        </button>
      </div>

      {/* Meetings List */}
      <div className="space-y-3">
        {filteredMeetings.map((meeting) => (
          <div
            key={meeting.id}
            className={`p-4 rounded-lg border ${
              meeting.status === 'cancelled' ? 'bg-red-900 bg-opacity-20 border-red-700' :
              meeting.status === 'completed' ? 'bg-slate-900 bg-opacity-30 border-slate-700' :
              'bg-slate-800 border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(meeting.status)} text-white`}>
                  {getStatusLabel(meeting.status)}
                </span>
                {new Date(meeting.datetime) > new Date() && meeting.status !== 'cancelled' && (
                  <span className="text-xs text-amber-400 font-medium">
                    {getTimeUntilMeeting(meeting.datetime)}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400">
                {new Date(meeting.datetime).toLocaleString('cs-CZ')}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-xs text-slate-400">📍 Místo</div>
                <div className="text-sm text-slate-200">{meeting.place.name}</div>
                <div className="text-xs text-slate-500">{meeting.place.address}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">🔑 Match</div>
                <div className="text-sm text-slate-400 font-mono truncate">
                  {meeting.matchKey.substring(0, 40)}...
                </div>
              </div>
            </div>

            {/* Actions */}
            {meeting.status !== 'completed' && meeting.status !== 'cancelled' && (
              <div className="flex gap-2 pt-3 border-t border-slate-700">
                <button
                  onClick={() => sendReminder(meeting.matchKey)}
                  disabled={meeting.reminderSent}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    meeting.reminderSent
                      ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {meeting.reminderSent ? '✅ Připomenuto' : '🔔 Připomenout'}
                </button>
                <button
                  onClick={() => markCompleted(meeting.matchKey)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors"
                >
                  ✔️ Dokončit
                </button>
                <button
                  onClick={() => cancelMeeting(meeting.matchKey)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-medium transition-colors"
                >
                  ❌ Zrušit
                </button>
              </div>
            )}

            {meeting.status === 'completed' && (
              <div className="text-xs text-slate-500 pt-3 border-t border-slate-700">
                ✅ Schůzka byla dokončena
              </div>
            )}

            {meeting.status === 'cancelled' && (
              <div className="text-xs text-red-400 pt-3 border-t border-slate-700">
                ❌ Schůzka byla zrušena
              </div>
            )}
          </div>
        ))}

        {filteredMeetings.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            {filter === 'upcoming' 
              ? '🎉 Žádné nadcházející schůzky'
              : filter === 'completed'
              ? 'Žádné dokončené schůzky'
              : 'Žádné schůzky'}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingReminders;
