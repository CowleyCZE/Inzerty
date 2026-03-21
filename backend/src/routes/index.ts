/**
 * Main Router - Centrální router pro všechny API endpointy
 */

import { Router } from 'express';
import ollamaRoutes from './ollama.routes.js';
import settingsRoutes from './settings.routes.js';
import scrapingRoutes from './scraping.routes.js';
import matchesRoutes, { compare } from './matches.routes.js';
import logsRoutes from './logs.routes.js';
import databaseRoutes from './database.routes.js';
import matchMetaRoutes from './match-meta.routes.js';
import alertsRoutes from './alerts.routes.js';
import exportRoutes from './export.routes.js';
import followupsRoutes from './followups.routes.js';
import templatesRoutes from './templates.routes.js';

const router = Router();

// Register all routes
router.use('/ollama', ollamaRoutes);
router.use('/settings', settingsRoutes);
router.use('/scrape-all', scrapingRoutes);
router.post('/compare', compare);  // Direct route for compare endpoint
router.use('/matches', matchesRoutes);
router.use('/logs', logsRoutes);
router.use('/database', databaseRoutes);
router.use('/match-meta', matchMetaRoutes);
router.use('/alerts', alertsRoutes);
router.use('/export', exportRoutes);
router.use('/followups', followupsRoutes);
router.use('/templates', templatesRoutes);

export default router;
