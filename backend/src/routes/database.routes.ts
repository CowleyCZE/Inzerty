/**
 * Database Routes - API endpointy pro databázi
 */

import { Router } from 'express';
import { clear } from '../controllers/database.controller.js';

const router = Router();

router.post('/clear', clear);

export default router;
