import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

interface Client extends WebSocket {
  userId?: string;
  matchKeys?: string[];
}

interface Notification {
  type: 'match_created' | 'match_updated' | 'fraud_alert' | 'meeting_reminder' | 'verification_code';
  title: string;
  message: string;
  data?: any;
  timestamp: string;
  priority: 'low' | 'medium' | 'high';
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Client> = new Map();
  private matchSubscribers: Map<string, Set<Client>> = new Map();

  initialize(port: number) {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: Client, request: IncomingMessage) => {
      const url = new URL(request.url || '', `http://localhost:${port}`);
      const userId = url.searchParams.get('userId') || 'anonymous';
      const matchKeys = url.searchParams.get('matchKeys')?.split(',') || [];

      ws.userId = userId;
      ws.matchKeys = matchKeys;

      console.log(`🔌 Client connected: ${userId}`);
      this.clients.set(userId, ws);

      // Subscribe to match updates
      matchKeys.forEach(key => {
        if (!this.matchSubscribers.has(key)) {
          this.matchSubscribers.set(key, new Set());
        }
        this.matchSubscribers.get(key)?.add(ws);
      });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`🔌 Client disconnected: ${userId}`);
        this.clients.delete(userId);
        
        // Unsubscribe from matches
        matchKeys.forEach(key => {
          this.matchSubscribers.get(key)?.delete(ws);
        });
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${userId}:`, error);
      });

      // Send welcome message
      this.sendToClient(ws, {
        type: 'welcome',
        title: 'Připojeno',
        message: 'Real-time notifikace jsou aktivní',
        timestamp: new Date().toISOString(),
        priority: 'low',
      });
    });

    console.log(`🚀 WebSocket server running on port ${port}`);
  }

  private handleMessage(client: Client, data: any) {
    switch (data.type) {
      case 'subscribe':
        this.subscribeToMatch(client, data.matchKey);
        break;
      case 'unsubscribe':
        this.unsubscribeFromMatch(client, data.matchKey);
        break;
      case 'ack':
        this.handleAcknowledgment(client, data.notificationId);
        break;
    }
  }

  private subscribeToMatch(client: Client, matchKey: string) {
    if (!client.matchKeys) {
      client.matchKeys = [];
    }
    if (!client.matchKeys.includes(matchKey)) {
      client.matchKeys.push(matchKey);
    }
    
    if (!this.matchSubscribers.has(matchKey)) {
      this.matchSubscribers.set(matchKey, new Set());
    }
    this.matchSubscribers.get(matchKey)?.add(client);
    
    console.log(`📌 Client ${client.userId} subscribed to ${matchKey}`);
  }

  private unsubscribeFromMatch(client: Client, matchKey: string) {
    if (client.matchKeys) {
      client.matchKeys = client.matchKeys.filter(k => k !== matchKey);
    }
    this.matchSubscribers.get(matchKey)?.delete(client);
    
    console.log(`📍 Client ${client.userId} unsubscribed from ${matchKey}`);
  }

  private handleAcknowledgment(client: Client, notificationId: string) {
    console.log(`✅ Notification ${notificationId} acknowledged by ${client.userId}`);
  }

  public sendToClient(client: Client, notification: Notification) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        id: Date.now().toString(),
        ...notification,
      }));
    }
  }

  public sendToUser(userId: string, notification: Notification) {
    const client = this.clients.get(userId);
    if (client) {
      this.sendToClient(client, notification);
    }
  }

  public sendToMatchSubscribers(matchKey: string, notification: Notification) {
    const subscribers = this.matchSubscribers.get(matchKey);
    if (subscribers) {
      subscribers.forEach(client => {
        this.sendToClient(client, notification);
      });
    }
  }

  public broadcast(notification: Notification) {
    this.clients.forEach(client => {
      this.sendToClient(client, notification);
    });
  }

  public notifyNewMatch(matchKey: string, userId: string) {
    this.sendToMatchSubscribers(matchKey, {
      type: 'match_created',
      title: 'Nová shoda!',
      message: 'Byla nalezena nová shoda inzerátů',
      data: { matchKey },
      timestamp: new Date().toISOString(),
      priority: 'high',
    });
  }

  public notifyFraudAlert(matchKey: string, userId: string, riskLevel: string) {
    this.sendToMatchSubscribers(matchKey, {
      type: 'fraud_alert',
      title: '⚠️ Upozornění na podvod',
      message: `Detekováno ${riskLevel} riziko u obchodu`,
      data: { matchKey, riskLevel },
      timestamp: new Date().toISOString(),
      priority: 'high',
    });
  }

  public notifyMeetingReminder(matchKey: string, userId: string, meetingTime: string) {
    this.sendToUser(userId, {
      type: 'meeting_reminder',
      title: '📅 Připomínka schůzky',
      message: `Schůzka za 30 minut`,
      data: { matchKey, meetingTime },
      timestamp: new Date().toISOString(),
      priority: 'medium',
    });
  }

  public notifyVerificationCode(userId: string, code: string) {
    this.sendToUser(userId, {
      type: 'verification_code',
      title: '🔐 Ověřovací kód',
      message: `Váš ověřovací kód je: ${code}`,
      data: { code },
      timestamp: new Date().toISOString(),
      priority: 'high',
    });
  }

  public getStats() {
    return {
      connectedClients: this.clients.size,
      subscribedMatches: this.matchSubscribers.size,
      clients: Array.from(this.clients.keys()),
    };
  }
}

export const wsService = new WebSocketService();
export type { Notification };
