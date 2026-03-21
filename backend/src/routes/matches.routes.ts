/**
 * Matches Routes - API endpointy pro matches a porovnávání
 */

import { Router } from 'express';
import { compare, exportMatches, getSeen, markSeen, bulkUpdate, getStats } from '../controllers/matches.controller.js';

const router = Router();

router.post('/compare', compare);
router.get('/export', exportMatches);
router.get('/seen', getSeen);
router.post('/mark-seen', markSeen);
router.post('/bulk-update', bulkUpdate);
router.get('/stats', getStats);

export default router;
export { compare };
