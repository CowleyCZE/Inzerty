/**
 * Alerts Routes - API endpointy pro notifikace a alerty
 */

import { Router } from 'express';
import { getConfig, saveConfig, test, notify } from '../controllers/alerts.controller.js';

const router = Router();

router.get('/config', getConfig);
router.post('/config', saveConfig);
router.post('/test', test);
router.post('/notify', notify);

export default router;
