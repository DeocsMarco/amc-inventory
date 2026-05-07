import { Request, Response } from 'express';
import { transactionService } from './transaction.service';

export class TransactionController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { itemId, date, startDate, endDate } = req.query;
      const transactions = transactionService.getAllTransactions({
        itemId: itemId ? parseInt(itemId as string) : undefined,
        date: date as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const transaction = transactionService.getTransactionById(id);
      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { itemId, date, type, quantity, notes } = req.body;
      if (!itemId || !date || !type || quantity === undefined) {
        res.status(400).json({ error: 'itemId, date, type, and quantity are required' });
        return;
      }
      const transaction = transactionService.createTransaction({ itemId, date, type, quantity, notes });
      res.status(201).json(transaction);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async upsert(req: Request, res: Response): Promise<void> {
    try {
      const { itemId, date, type, quantity, notes } = req.body;
      if (!itemId || !date || !type || quantity === undefined) {
        res.status(400).json({ error: 'itemId, date, type, and quantity are required' });
        return;
      }
      const transaction = transactionService.upsertTransaction({ itemId, date, type, quantity, notes });
      res.json(transaction);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      transactionService.deleteTransaction(id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getDaily(req: Request, res: Response): Promise<void> {
    try {
      const { date } = req.params;
      if (!date) {
        res.status(400).json({ error: 'date is required' });
        return;
      }
      const transactions = transactionService.getDailyTransactions(date);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async bulkCreate(req: Request, res: Response): Promise<void> {
    try {
      const { transactions } = req.body;
      if (!Array.isArray(transactions)) {
        res.status(400).json({ error: 'transactions array is required' });
        return;
      }
      const count = transactionService.recordBulkTransactions(transactions);
      res.status(201).json({ created: count });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}

export const transactionController = new TransactionController();
