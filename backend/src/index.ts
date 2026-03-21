/**
 * Český Inzertní Scraper UI - Backend Entry Point
 */

import app from './app.js';
import { initDb } from './database.js';
import { wsService } from './websocket.js';
import { ollamaManager } from './utils/ollama-manager.js';
import { runtimeLogger } from './utils/logger.js';

const PORT = Number(process.env.PORT) || 3001;
const WS_PORT = Number(process.env.WS_PORT) || 3002;

// Global Error Handling
process.on('uncaughtException', (err) => {
    console.error('Critical Uncaught Exception:', err);
    runtimeLogger.error(`Kritická chyba systému: ${err.message}`);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    runtimeLogger.error(`Nevyřízený asynchronní slib: ${reason}`);
});

/**
 * Server Bootstrap
 */
const bootstrap = async () => {
    try {
        // 1. Initialize Database
        await initDb();
        runtimeLogger.info('Databáze inicializována.');

        // 2. Initialize WebSocket Service
        wsService.initialize(WS_PORT);
        runtimeLogger.info(`WebSocket server připraven na portu ${WS_PORT}`);

        // 3. Start Express Server
        const server = app.listen(PORT, () => {
            runtimeLogger.success(`🚀 REST API běží na http://localhost:${PORT}`);
            runtimeLogger.success(`📡 WebSockets běží na ws://localhost:${WS_PORT}`);
        });

        // Handle Server Errors
        server.on('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                runtimeLogger.error(`Port ${PORT} je již obsazen jinou aplikací.`);
                process.exit(1);
            }
            runtimeLogger.error(`Chyba Express serveru: ${err.message}`);
        });

        // Graceful Shutdown
        const shutdown = () => {
            runtimeLogger.info('Vypínám server...');
            server.close(() => {
                ollamaManager.dispose();
                wsService.dispose();
                runtimeLogger.info('Server bezpečně ukončen.');
                process.exit(0);
            });
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (error) {
        runtimeLogger.error(`Chyba při startu serveru: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
    }
};

bootstrap();

// Keep process alive
process.stdin.resume();
