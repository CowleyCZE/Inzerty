/**
 * Ollama Routes - API endpointy pro správu Ollama
 */

import { Router } from 'express';
import { toggle, getStatus } from '../controllers/ollama.controller.js';

const router = Router();

router.post('/toggle', toggle);
router.get('/status', getStatus);

export default router;
