import { Request, Response } from 'express';
import { exportService } from './export.service';

export class ExportController {
  async exportXlsx(req: Request, res: Response): Promise<void> {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

      if (month < 1 || month > 12) {
        res.status(400).json({ error: 'Month must be between 1 and 12' });
        return;
      }

      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

      const workbook = await exportService.exportMonthlyXlsx(year, month);

      const filename = `inventory_${monthNames[month]}_${year}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}

export const exportController = new ExportController();
