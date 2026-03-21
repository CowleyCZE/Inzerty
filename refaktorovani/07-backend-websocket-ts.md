# Plán refaktorování: backend/src/websocket.ts

## 📊 Stav

- **Počet řádků**: 218
- **Hlavní zodpovědnosti**:
  - WebSocket server pro real-time notifikace
  - Client management (připojení, odpojení)
  - Message routing podle typu
  - User-specific messaging
  - Broadcast functionality
  - Stats tracking
  - Error handling

## ⚠️ Problémy

1. **Chybí typování** - `any` typy pro WebSocket clients
2. **Žádná abstrakce** - Všechno v jedné třídě
3. **Těžké testování** - Nelze mockovat WebSocket
4. **Chybí authentication** - Žádná validace klientů
5. **Memory leak risk** - Neuklizené connection

## 📋 Navrhované rozdělení

### 1. `websocket/types.ts` (Nový soubor)
**Responsibility**: TypeScript typy pro WebSocket

```typescript
import { WebSocket } from 'ws';

export type MessageType =
  | 'match_created'
  | 'match_updated'
  | 'fraud_alert'
  | 'meeting_reminder'
  | 'scraping_progress'
  | 'scraping_complete'
  | 'automation_result'
  | 'verification_code'
  | 'error';

export interface WSMessage {
  type: MessageType;
  title: string;
  message: string;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  data?: Record<string, any>;
}

export interface WSClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  connectedAt: Date;
  lastActivityAt: Date;
  messageCount: number;
  isAlive: boolean;
}

export interface WSStats {
  totalConnections: number;
  activeConnections: number;
  totalMessagesSent: number;
  messagesByType: Record<MessageType, number>;
  uptime: number;
}

export interface WSServiceConfig {
  port: number;
  path?: string;
  heartbeatInterval?: number;
  maxClients?: number;
  allowedOrigins?: string[];
}
```

---

### 2. `websocket/WSClientManager.ts` (Nový soubor)
**Responsibility**: Management WebSocket klientů

```typescript
import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { WSClient, WSStats } from './types.js';

export class WSClientManager {
  private clients: Map<string, WSClient> = new Map();
  private readonly maxClients: number;

  constructor(maxClients: number = 100) {
    this.maxClients = maxClients;
  }

  addClient(ws: WebSocket, userId?: string): string {
    if (this.clients.size >= this.maxClients) {
      ws.close(1013, 'Too many clients');
      throw new Error('Maximum client limit reached');
    }

    const id = randomUUID();
    const client: WSClient = {
      id,
      ws,
      userId,
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      messageCount: 0,
      isAlive: true,
    };

    this.clients.set(id, client);
    return id;
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.ws.terminate();
      this.clients.delete(clientId);
    }
  }

  getClient(clientId: string): WSClient | undefined {
    return this.clients.get(clientId);
  }

  getClientByUserId(userId: string): WSClient[] {
    return Array.from(this.clients.values()).filter(
      (client) => client.userId === userId
    );
  }

  updateClientActivity(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivityAt = new Date();
      client.messageCount++;
    }
  }

  markClientAsDead(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = false;
    }
  }

  getActiveClients(): WSClient[] {
    return Array.from(this.clients.values()).filter(
      (client) => client.isAlive && client.ws.readyState === WebSocket.OPEN
    );
  }

  getStats(): WSStats {
    const activeClients = this.getActiveClients();
    return {
      totalConnections: this.clients.size,
      activeConnections: activeClients.length,
      totalMessagesSent: Array.from(this.clients.values())
        .reduce((sum, c) => sum + c.messageCount, 0),
      messagesByType: {}, // Would track in send methods
      uptime: Date.now(),
    };
  }

  cleanup(): void {
    for (const [id, client] of this.clients.entries()) {
      client.ws.terminate();
      this.clients.delete(id);
    }
  }
}
```

---

### 3. `websocket/WSMessageRouter.ts` (Nový soubor)
**Responsibility**: Routing a zpracování zpráv

```typescript
import { WebSocket } from 'ws';
import { WSMessage, MessageType } from './types.js';

export class WSMessageRouter {
  private handlers: Map<MessageType, (data: any) => Promise<any>> = new Map();

  registerHandler(
    type: MessageType,
    handler: (data: any) => Promise<any>
  ): void {
    this.handlers.set(type, handler);
  }

  async handleMessage(
    ws: WebSocket,
    message: WSMessage
  ): Promise<void> {
    const handler = this.handlers.get(message.type);
    
    if (!handler) {
      this.sendError(ws, `Unknown message type: ${message.type}`);
      return;
    }

    try {
      const result = await handler(message.data);
      this.send(ws, {
        type: message.type,
        title: 'Success',
        message: 'Operation completed',
        timestamp: new Date().toISOString(),
        priority: 'low',
        data: result,
      });
    } catch (error) {
      this.sendError(ws, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  send(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendError(ws: WebSocket, errorMessage: string): void {
    this.send(ws, {
      type: 'error',
      title: 'Error',
      message: errorMessage,
      timestamp: new Date().toISOString(),
      priority: 'high',
    });
  }

  broadcast(
    clients: WebSocket[],
    message: WSMessage
  ): void {
    const data = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
}
```

---

### 4. `websocket/WSServer.ts` (Nový soubor)
**Responsibility**: WebSocket server setup

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { WSServiceConfig, WSMessage, WSClient } from './types.js';
import { WSClientManager } from './WSClientManager.js';
import { WSMessageRouter } from './WSMessageRouter.js';

export class WSServer {
  private wss: WebSocketServer | null = null;
  private clientManager: WSClientManager;
  private messageRouter: WSMessageRouter;
  private config: WSServiceConfig;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(config: WSServiceConfig) {
    this.config = config;
    this.clientManager = new WSClientManager(config.maxClients);
    this.messageRouter = new WSMessageRouter();
  }

  start(): void {
    this.wss = new WebSocketServer({
      port: this.config.port,
      path: this.config.path || '/',
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.startHeartbeat();
  }

  private handleConnection(ws: WebSocket, req: any): void {
    // Validate origin
    if (this.config.allowedOrigins) {
      const origin = req.headers.origin;
      if (origin && !this.config.allowedOrigins.includes(origin)) {
        ws.close(1008, 'Forbidden origin');
        return;
      }
    }

    // Extract userId from query params or headers
    const url = new URL(req.url || '', 'http://localhost');
    const userId = url.searchParams.get('userId') || undefined;

    // Add client
    const clientId = this.clientManager.addClient(ws, userId);

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'verification_code',
      title: 'Connected',
      message: `Your client ID: ${clientId}`,
      timestamp: new Date().toISOString(),
      priority: 'low',
      data: { clientId, userId },
    });

    // Setup handlers
    ws.on('message', (data) => this.handleMessage(clientId, data));
    ws.on('close', () => this.handleClose(clientId));
    ws.on('error', (error) => this.handleError(clientId, error));
  }

  private handleMessage(clientId: string, data: any): void {
    this.clientManager.updateClientActivity(clientId);
    
    try {
      const message = JSON.parse(data.toString()) as WSMessage;
      const client = this.clientManager.getClient(clientId);
      if (client) {
        this.messageRouter.handleMessage(client.ws, message);
      }
    } catch (error) {
      const client = this.clientManager.getClient(clientId);
      if (client) {
        this.messageRouter.sendError(client.ws, 'Invalid message format');
      }
    }
  }

  private handleClose(clientId: string): void {
    this.clientManager.removeClient(clientId);
  }

  private handleError(clientId: string, error: Error): void {
    console.error(`WebSocket error for client ${clientId}:`, error);
    this.clientManager.markClientAsDead(clientId);
  }

  private startHeartbeat(): void {
    const interval = this.config.heartbeatInterval || 30000;
    
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;

      for (const [clientId, client] of this.clientManager.getActiveClients().entries()) {
        if (!client.isAlive) {
          this.clientManager.removeClient(clientId);
          continue;
        }

        client.isAlive = false;
        client.ws.ping();
      }
    }, interval);

    this.wss?.on('pong', (clientId: any) => {
      const client = this.clientManager.getClient(clientId);
      if (client) {
        client.isAlive = true;
      }
    });
  }

  sendToClient(clientId: string, message: WSMessage): void {
    const client = this.clientManager.getClient(clientId);
    if (client) {
      this.messageRouter.send(client.ws, message);
    }
  }

  sendToUser(userId: string, message: WSMessage): void {
    const clients = this.clientManager.getClientByUserId(userId);
    for (const client of clients) {
      this.messageRouter.send(client.ws, message);
    }
  }

  broadcast(message: WSMessage): void {
    const clients = this.clientManager.getActiveClients();
    this.messageRouter.broadcast(
      clients.map((c) => c.ws),
      message
    );
  }

  getStats() {
    return this.clientManager.getStats();
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.clientManager.cleanup();
    this.wss?.close();
  }
}
```

---

### 5. `websocket/index.ts` (Nový soubor)
**Responsibility**: Exporty a singleton instance

```typescript
import { WSServer } from './WSServer.js';
import { WSServiceConfig, WSMessage, MessageType } from './types.js';

const DEFAULT_CONFIG: WSServiceConfig = {
  port: 3002,
  path: '/',
  heartbeatInterval: 30000,
  maxClients: 100,
  allowedOrigins: ['http://localhost:5173', 'http://localhost:3000'],
};

let wsServerInstance: WSServer | null = null;

export const initWSServer = (config?: Partial<WSServiceConfig>): WSServer => {
  if (wsServerInstance) {
    return wsServerInstance;
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  wsServerInstance = new WSServer(finalConfig);
  wsServerInstance.start();
  
  return wsServerInstance;
};

export const getWSServer = (): WSServer | null => {
  return wsServerInstance;
};

export const stopWSServer = (): void => {
  wsServerInstance?.stop();
  wsServerInstance = null;
};

// Re-export types
export type { WSServiceConfig, WSMessage, MessageType };
```

---

## 🔄 Změny v importech

### Původní `websocket.ts`:
```typescript
// Jedna třída s vším (218 řádků)
class WSService {
  // Všechna logika uvnitř
}
export const wsService = new WSService();
```

### Nový `websocket/index.ts`:
```typescript
import { WSServer } from './WSServer.js';
import { WSClientManager } from './WSClientManager.js';
import { WSMessageRouter } from './WSMessageRouter.js';
import { initWSServer, getWSServer, stopWSServer } from './index.js';

// Usage in index.ts:
import { initWSServer } from './websocket/index.js';

const wsServer = initWSServer({ port: 3002 });

// Send notifications
wsServer.broadcast({
  type: 'match_created',
  title: 'New match found',
  message: '...',
  timestamp: new Date().toISOString(),
  priority: 'medium',
});
```

---

## 📅 Fáze refaktorování

### Fáze 1: Typy (0.5 dne)
- [ ] `websocket/types.ts`

### Fáze 2: Client Manager (0.5 dne)
- [ ] `websocket/WSClientManager.ts`

### Fáze 3: Message Router (0.5 dne)
- [ ] `websocket/WSMessageRouter.ts`

### Fáze 4: WS Server (1 den)
- [ ] `websocket/WSServer.ts`

### Fáze 5: Integrace (0.5 dne)
- [ ] `websocket/index.ts`
- [ ] Aktualizovat importy v `index.ts`
- [ ] Otestovat všechny funkce
- [ ] Odstranit původní kód

---

## ✅ Výhody po refaktorování

1. **Typová bezpečnost** - Plné TypeScript typy
2. **Testovatelnost** - Lze mockovat každou třídu
3. **Separation of Concerns** - Každá třída má jednu odpovědnost
4. **Rozšiřitelnost** - Snadné přidávat nové message types
5. **Bezpečnost** - Origin validation, client limits
6. **Monitoring** - Lepší stats tracking
7. **Memory management** - Automatický cleanup

---

*Vygenerováno: 2026-03-16*
*Autor: Autonomous Lead Fullstack Developer*
