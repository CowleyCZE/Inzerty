/**
 * Express Application Configuration
 */

import express from 'express';
import cors from 'cors';
import router from './routes/index.js';
import { wsService } from './websocket.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.use(router);

// WebSocket API Endpoints (internal housekeeping)
app.get('/ws/stats', (req, res) => {
    res.json({ success: true, stats: wsService.getStats() });
});

app.post('/ws/test', (req, res) => {
    const { userId, type, title, message } = req.body;
    const payload = {
        type: type || 'match_created',
        title: title || 'Testová notifikace',
        message: message || 'Toto je testová notifikace',
        timestamp: new Date().toISOString(),
        priority: 'low' as const,
    };
    if (userId) {
        wsService.sendToUser(userId, payload);
    } else {
        wsService.broadcast(payload);
    }
    res.json({ success: true, message: 'Notifikace odeslána' });
});

export default app;
