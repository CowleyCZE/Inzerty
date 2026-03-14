import { useEffect, useState, useCallback } from 'react';

interface Notification {
  id: string;
  type: 'match_created' | 'match_updated' | 'fraud_alert' | 'meeting_reminder' | 'verification_code' | 'welcome';
  title: string;
  message: string;
  data?: any;
  timestamp: string;
  priority: 'low' | 'medium' | 'high';
  read: boolean;
}

interface UseWebSocketOptions {
  userId?: string;
  matchKeys?: string[];
  autoConnect?: boolean;
}

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3002';

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const { userId = 'user-' + Math.random().toString(36).substr(2, 9), matchKeys = [], autoConnect = true } = options;
  
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const connect = useCallback(() => {
    const params = new URLSearchParams();
    params.set('userId', userId);
    if (matchKeys.length > 0) {
      params.set('matchKeys', matchKeys.join(','));
    }

    const websocket = new WebSocket(`${WS_URL}?${params.toString()}`);

    websocket.onopen = () => {
      console.log('🔌 WebSocket connected');
      setConnected(true);
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const notification: Notification = JSON.parse(event.data);
        console.log('📬 Notification received:', notification);
        
        setNotifications(prev => [notification, ...prev]);
        
        if (notification.type !== 'welcome') {
          setUnreadCount(prev => prev + 1);
          
          // Show browser notification
          if (Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.message,
              icon: '/logo192.png',
              badge: '/logo192.png',
            });
          }
        }
      } catch (error) {
        console.error('Error parsing notification:', error);
      }
    };

    websocket.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setConnected(false);
      setWs(null);
      
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (autoConnect) {
          console.log('🔄 Attempting to reconnect...');
          connect();
        }
      }, 5000);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [userId, matchKeys, autoConnect]);

  const disconnect = useCallback(() => {
    if (ws) {
      ws.close();
      setWs(null);
      setConnected(false);
    }
  }, [ws]);

  const subscribeToMatch = useCallback((matchKey: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'subscribe',
        matchKey,
      }));
    }
  }, [ws]);

  const unsubscribeFromMatch = useCallback((matchKey: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'unsubscribe',
        matchKey,
      }));
    }
  }, [ws]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ack',
        notificationId,
      }));
    }
  }, [ws]);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (autoConnect && !ws) {
      connect();
    }
    
    return () => {
      if (ws) {
        disconnect();
      }
    };
  }, [autoConnect, connect, disconnect, ws]);

  return {
    connected,
    notifications,
    unreadCount,
    connect,
    disconnect,
    subscribeToMatch,
    unsubscribeFromMatch,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  };
};

export default useWebSocket;
