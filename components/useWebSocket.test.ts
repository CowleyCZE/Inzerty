import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useWebSocket, { type Notification } from './useWebSocket.js';

describe('useWebSocket', () => {
  let mockWebSocketInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock WebSocket
    mockWebSocketInstance = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: WebSocket.OPEN,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    };

    global.WebSocket = vi.fn().mockImplementation(function() {
      return mockWebSocketInstance;
    }) as unknown as typeof WebSocket;
    
    // Mock Notification
    global.Notification = vi.fn() as unknown as typeof Notification;
    (global.Notification as any).permission = 'granted';
    (global.Notification as any).requestPermission = vi.fn().mockResolvedValue('granted');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects to websocket on mount', () => {
    const { result } = renderHook(() => useWebSocket({ autoConnect: true }));
    
    // Auto-connects
    expect(global.WebSocket).toHaveBeenCalled();
    
    // Simulate open
    act(() => {
      mockWebSocketInstance.onopen();
    });
    
    expect(result.current.connected).toBe(true);
  });

  it('receives notification and updates unread count', () => {
    const { result } = renderHook(() => useWebSocket({ autoConnect: true }));
    
    act(() => {
      mockWebSocketInstance.onopen();
    });

    const mockNotification: Notification = {
      id: '1',
      type: 'match_created',
      title: 'Test',
      message: 'Test message',
      timestamp: new Date().toISOString(),
      priority: 'high',
      read: false
    };

    act(() => {
      mockWebSocketInstance.onmessage({ data: JSON.stringify(mockNotification) });
    });

    expect(result.current.notifications.length).toBe(1);
    expect(result.current.unreadCount).toBe(1);
    expect(global.Notification).toHaveBeenCalledWith('Test', expect.any(Object));
  });

  it('does not increment unread count for welcome messages', () => {
    const { result } = renderHook(() => useWebSocket({ autoConnect: true }));
    
    act(() => {
      mockWebSocketInstance.onopen();
    });

    const welcomeNotification: Notification = {
      id: '2',
      type: 'welcome',
      title: 'Welcome',
      message: 'Hello',
      timestamp: new Date().toISOString(),
      priority: 'low',
      read: false
    };

    act(() => {
      mockWebSocketInstance.onmessage({ data: JSON.stringify(welcomeNotification) });
    });

    expect(result.current.notifications.length).toBe(1);
    expect(result.current.unreadCount).toBe(0);
  });

  it('marks notifications as read', () => {
     const { result } = renderHook(() => useWebSocket({ autoConnect: true }));
    
    act(() => {
      mockWebSocketInstance.onopen();
      const notif: Notification = {
        id: '1', type: 'match_created', title: 'T', message: 'M',
        timestamp: new Date().toISOString(), priority: 'low', read: false
      };
      mockWebSocketInstance.onmessage({ data: JSON.stringify(notif) });
    });

    expect(result.current.unreadCount).toBe(1);
    
    act(() => {
      result.current.markAsRead('1');
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications[0]?.read).toBe(true);
    expect(mockWebSocketInstance.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'ack',
      notificationId: '1'
    }));
  });

  it('subscribes and unsubscribes from matches', () => {
    const { result } = renderHook(() => useWebSocket({ autoConnect: true }));
    
    act(() => {
      mockWebSocketInstance.onopen();
    });

    act(() => {
      result.current.subscribeToMatch('match-123');
    });

    expect(mockWebSocketInstance.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'subscribe',
      matchKey: 'match-123'
    }));

    act(() => {
      result.current.unsubscribeFromMatch('match-123');
    });

    expect(mockWebSocketInstance.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'unsubscribe',
      matchKey: 'match-123'
    }));
  });
});
