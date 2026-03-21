/**
 * Match Meta Routes - API endpointy pro metadata matchů
 */

import { Router } from 'express';
import { save, dailyReport } from '../controllers/match-meta.controller.js';

const router = Router();

router.post('/', save);
router.get('/reports/daily', dailyReport);

export default router;
