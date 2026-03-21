/**
 * Templates Routes - API endpointy pro šablony zpráv
 */

import { Router } from 'express';
import { getMessages, saveMessages } from '../controllers/templates.controller.js';

const router = Router();

router.get('/messages', getMessages);
router.post('/messages', saveMessages);

export default router;
