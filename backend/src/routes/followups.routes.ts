/**
 * Followups Routes - API endpointy pro follow-upy
 */

import { Router } from 'express';
import { get, getSummary, sendReminder } from '../controllers/followups.controller.js';

const router = Router();

router.get('/', get);
router.get('/summary', getSummary);
router.post('/:matchKey/remind', sendReminder);

export default router;
