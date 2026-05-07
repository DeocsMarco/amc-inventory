import { Request, Response } from 'express';
import { reportService } from './report.service';

export class ReportController {
  async getSoh(req: Request, res: Response): Promise<void> {
    try {
      const report = reportService.getSohReport();
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getDailySummary(req: Request, res: Response): Promise<void> {
    try {
      const { date } = req.params;
      if (!date) {
        res.status(400).json({ error: 'date is required' });
        return;
      }
      const summary = reportService.getDailySummary(date);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getCategorySummary(req: Request, res: Response): Promise<void> {
    try {
      const summary = reportService.getCategorySummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getMonthlyReport(req: Request, res: Response): Promise<void> {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);

      if (!year || !month || month < 1 || month > 12) {
        res.status(400).json({ error: 'Valid year and month (1-12) are required' });
        return;
      }

      const report = reportService.getMonthlyReport(year, month);
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const stats = reportService.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}

export const reportController = new ReportController();
