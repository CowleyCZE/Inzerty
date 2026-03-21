/**
 * Export Controller - Export dat do CSV a Google Sheets
 */

import type { Request, Response } from 'express';

// Mock config storage
const sheetsConfig: any = {
  apiKey: '',
  spreadsheetId: '',
  sheetName: 'Arbitráže',
  webhookUrl: '',
  useWebhook: false,
};

export const exportCsv = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = req.body;
    
    // Create CSV content
    const headers = Object.keys(rows[0] || {}).join(',');
    const csvRows = rows.map((row: any) => 
      Object.values(row).map(val => 
        typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
      ).join(',')
    );
    
    const csv = [headers, ...csvRows].join('\n');
    
    res.json({
      success: true,
      csv,
      count: rows.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Export failed' });
  }
};

export const getSheetsConfig = (req: Request, res: Response): void => {
  res.json({ config: sheetsConfig });
};

export const saveSheetsConfig = (req: Request, res: Response): void => {
  Object.assign(sheetsConfig, req.body);
  res.json({ success: true, config: sheetsConfig });
};

export const exportToSheets = async (req: Request, res: Response): Promise<void> => {
  // Implementation would use Google Sheets API
  res.json({ success: true, updatedRows: req.body.rows?.length || 0 });
};

export const exportToSheetsWebhook = async (req: Request, res: Response): Promise<void> => {
  // Implementation would use Google Apps Script webhook
  res.json({ success: true, updatedRows: req.body.rows?.length || 0 });
};
