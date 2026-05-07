import api from './api';
import type { Transaction, TransactionWithItem, CreateTransactionDto, DailyTransaction } from '../types';

export const transactionService = {
  async getTransactions(filters?: {
    itemId?: number;
    date?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<TransactionWithItem[]> {
    const { data } = await api.get('/transactions', { params: filters });
    return data;
  },

  async getDailyTransactions(date: string): Promise<DailyTransaction[]> {
    const { data } = await api.get(`/transactions/daily/${date}`);
    return data;
  },

  async createTransaction(dto: CreateTransactionDto): Promise<Transaction> {
    const { data } = await api.post('/transactions', dto);
    return data;
  },

  async upsertTransaction(dto: CreateTransactionDto): Promise<Transaction> {
    const { data } = await api.put('/transactions/upsert', dto);
    return data;
  },

  async deleteTransaction(id: number): Promise<void> {
    await api.delete(`/transactions/${id}`);
  },

  async bulkCreate(transactions: CreateTransactionDto[]): Promise<{ created: number }> {
    const { data } = await api.post('/transactions/bulk', { transactions });
    return data;
  },
};
