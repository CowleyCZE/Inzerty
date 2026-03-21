/**
 * Export Routes - API endpointy pro export
 */

import { Router } from 'express';
import { exportCsv, getSheetsConfig, saveSheetsConfig, exportToSheets, exportToSheetsWebhook } from '../controllers/export.controller.js';

const router = Router();

router.post('/csv', exportCsv);
router.get('/sheets/config', getSheetsConfig);
router.post('/sheets/config', saveSheetsConfig);
router.post('/sheets', exportToSheets);
router.post('/sheets/webhook', exportToSheetsWebhook);

export default router;
