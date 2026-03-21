/**
 * Scraping Routes - API endpointy pro scrapování
 */

import { Router } from 'express';
import { scrapeAll, scrapeAllMulti } from '../controllers/scraping.controller.js';

const router = Router();

router.post('/', scrapeAll);
router.post('/multi', scrapeAllMulti);

export default router;
