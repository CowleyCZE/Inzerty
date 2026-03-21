/**
 * Settings Routes - API endpointy pro nastavení
 */

import { Router } from 'express';
import { get, save } from '../controllers/settings.controller.js';

const router = Router();

router.get('/', get);
router.post('/', save);

export default router;
