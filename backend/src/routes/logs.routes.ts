/**
 * Logs Routes - API endpointy pro logy
 */

import { Router } from 'express';
import { get, clear } from '../controllers/logs.controller.js';

const router = Router();

router.get('/', get);
router.post('/clear', clear);

export default router;
