import { transactionRepository } from './transaction.repository';
import { inventoryRepository } from '../inventory/inventory.repository';
import type { Transaction, TransactionWithItem, CreateTransactionDto, DailyTransaction } from '@amc/shared';

export class TransactionService {
  getAllTransactions(filters?: { itemId?: number; date?: string; startDate?: string; endDate?: string }): TransactionWithItem[] {
    return transactionRepository.findAll(filters);
  }

  getTransactionById(id: number): Transaction | undefined {
    return transactionRepository.findById(id);
  }

  createTransaction(dto: CreateTransactionDto): Transaction {
    // Validate item exists
    const item = inventoryRepository.findById(dto.itemId);
    if (!item) {
      throw new Error(`Item with id ${dto.itemId} not found`);
    }

    if (dto.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    return transactionRepository.create(dto);
  }

  upsertTransaction(dto: CreateTransactionDto): Transaction {
    const item = inventoryRepository.findById(dto.itemId);
    if (!item) {
      throw new Error(`Item with id ${dto.itemId} not found`);
    }

    return transactionRepository.upsert(dto);
  }

  deleteTransaction(id: number): void {
    const success = transactionRepository.delete(id);
    if (!success) {
      throw new Error(`Transaction with id ${id} not found`);
    }
  }

  getDailyTransactions(date: string): DailyTransaction[] {
    return transactionRepository.getDailyTransactions(date);
  }

  getItemTotals(itemId: number): { totalIn: number; totalOut: number } {
    return transactionRepository.getItemTotals(itemId);
  }

  recordBulkTransactions(transactions: CreateTransactionDto[]): number {
    // Filter out invalid transactions
    const validTransactions = transactions.filter(t => {
      const item = inventoryRepository.findById(t.itemId);
      return item && t.quantity > 0;
    });

    return transactionRepository.bulkCreate(validTransactions);
  }
}

export const transactionService = new TransactionService();
