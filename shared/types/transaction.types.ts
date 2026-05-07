export type TransactionType = 'IN' | 'OUT';

export interface Transaction {
  id: number;
  itemId: number;
  date: string;
  type: TransactionType;
  quantity: number;
  notes?: string;
  createdAt: string;
}

export interface TransactionWithItem extends Transaction {
  itemName: string;
  categoryName: string;
  unit: string;
}

export interface CreateTransactionDto {
  itemId: number;
  date: string;
  type: TransactionType;
  quantity: number;
  notes?: string;
}

export interface DailyTransaction {
  itemId: number;
  itemName: string;
  categoryName: string;
  unit: string;
  inQty: number;
  outQty: number;
}

export interface MonthlySnapshot {
  id: number;
  itemId: number;
  year: number;
  month: number;
  openingSoh: number;
  closingSoh: number;
  totalIn: number;
  totalOut: number;
}
