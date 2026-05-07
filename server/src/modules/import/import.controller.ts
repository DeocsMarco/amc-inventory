import { Request, Response } from 'express';
import { importService } from './import.service';
import fs from 'fs';

export class ImportController {
  async importXlsx(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const result = await importService.importFromXlsx(req.file.path);

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        message: 'Import successful',
        ...result,
      });
    } catch (error) {
      // Clean up file on error
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {}
      }
      res.status(500).json({ error: (error as Error).message });
    }
  }
}

export const importController = new ImportController();
