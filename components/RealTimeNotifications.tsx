import React from 'react';
import useWebSocket, { Notification } from './useWebSocket';

interface RealTimeNotificationsProps {
  userId?: string;
  matchKeys?: string[];
}

const RealTimeNotifications: React.FC<RealTimeNotificationsProps> = ({ userId, matchKeys }) => {
  const {
    connected,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  } = useWebSocket({ userId, matchKeys, autoConnect: true });

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'match_created': return '🎯';
      case 'match_updated': return '📝';
      case 'fraud_alert': return '⚠️';
      case 'meeting_reminder': return '📅';
      case 'verification_code': return '🔐';
      case 'welcome': return '👋';
      default: return '📬';
    }
  };

  const getNotificationColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-900 bg-opacity-20';
      case 'medium': return 'border-yellow-500 bg-yellow-900 bg-opacity-20';
      case 'low': return 'border-slate-500 bg-slate-900 bg-opacity-20';
      default: return 'border-slate-500 bg-slate-900 bg-opacity-20';
    }
  };

  const getRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Právě teď';
    if (diffMins < 60) return `Před ${diffMins} min`;
    if (diffHours < 24) return `Před ${diffHours} h`;
    return `Před ${diffDays} d`;
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-sky-400">
            🔔 Real-time notifikace
          </h3>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            connected
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}>
            {connected ? '🟢 Připojeno' : '🔴 Odpojeno'}
          </span>
          {unreadCount > 0 && (
            <span className="px-2 py-1 bg-red-600 text-white rounded-full text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Označit vše jako přečtené
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearNotifications}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Smazat vše
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-3">📭</div>
            <div>Žádné notifikace</div>
            <div className="text-sm mt-2">Budete dostávat notifikace v reálném čase</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => markAsRead(notification.id)}
                className={`p-4 border-l-4 cursor-pointer transition-colors hover:bg-slate-700 hover:bg-opacity-30 ${
                  getNotificationColor(notification.priority)
                } ${notification.read ? 'opacity-60' : 'opacity-100'}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-slate-200">{notification.title}</h4>
                      <span className="text-xs text-slate-400">
                        {getRelativeTime(notification.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 mb-2">{notification.message}</p>
                    {!notification.read && (
                      <span className="inline-block px-2 py-0.5 bg-sky-600 text-white rounded-full text-xs">
                        Nové
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTimeNotifications;
