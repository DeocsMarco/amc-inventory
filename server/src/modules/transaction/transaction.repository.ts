import { getDb } from '../../database';
import type { Transaction, TransactionWithItem, CreateTransactionDto, DailyTransaction } from '@amc/shared';

export class TransactionRepository {
  findAll(filters?: { itemId?: number; date?: string; startDate?: string; endDate?: string }): TransactionWithItem[] {
    const db = getDb();
    let query = `
      SELECT
        t.id, t.item_id as itemId, t.date, t.type, t.quantity, t.notes,
        t.created_at as createdAt,
        i.name as itemName, i.unit,
        c.name as categoryName
      FROM transactions t
      JOIN items i ON t.item_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.itemId) {
      query += ' AND t.item_id = ?';
      params.push(filters.itemId);
    }
    if (filters?.date) {
      query += ' AND t.date = ?';
      params.push(filters.date);
    }
    if (filters?.startDate) {
      query += ' AND t.date >= ?';
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ' AND t.date <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY t.date DESC, t.created_at DESC';

    return db.prepare(query).all(...params) as TransactionWithItem[];
  }

  findById(id: number): Transaction | undefined {
    const db = getDb();
    return db.prepare(`
      SELECT id, item_id as itemId, date, type, quantity, notes, created_at as createdAt
      FROM transactions WHERE id = ?
    `).get(id) as Transaction | undefined;
  }

  create(dto: CreateTransactionDto): Transaction {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO transactions (item_id, date, type, quantity, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(dto.itemId, dto.date, dto.type, dto.quantity, dto.notes);

    return this.findById(result.lastInsertRowid as number)!;
  }

  upsert(dto: CreateTransactionDto): Transaction {
    const db = getDb();
    // Try to find existing transaction for this item/date/type
    const existing = db.prepare(`
      SELECT id FROM transactions WHERE item_id = ? AND date = ? AND type = ?
    `).get(dto.itemId, dto.date, dto.type) as { id: number } | undefined;

    if (existing) {
      // Update existing
      db.prepare(`
        UPDATE transactions SET quantity = ?, notes = ? WHERE id = ?
      `).run(dto.quantity, dto.notes, existing.id);
      return this.findById(existing.id)!;
    }

    return this.create(dto);
  }

  delete(id: number): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getItemTotals(itemId: number): { totalIn: number; totalOut: number } {
    const db = getDb();
    const result = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END), 0) as totalIn,
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END), 0) as totalOut
      FROM transactions
      WHERE item_id = ?
    `).get(itemId) as { totalIn: number; totalOut: number };
    return result;
  }

  getDailyTransactions(date: string): DailyTransaction[] {
    const db = getDb();
    return db.prepare(`
      SELECT
        i.id as itemId, i.name as itemName, i.unit,
        c.name as categoryName,
        COALESCE(SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE 0 END), 0) as inQty,
        COALESCE(SUM(CASE WHEN t.type = 'OUT' THEN t.quantity ELSE 0 END), 0) as outQty
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN transactions t ON i.id = t.item_id AND t.date = ?
      WHERE i.is_active = 1
      GROUP BY i.id
      HAVING inQty > 0 OR outQty > 0
      ORDER BY c.sort_order, i.name
    `).all(date) as DailyTransaction[];
  }

  bulkCreate(transactions: CreateTransactionDto[]): number {
    const db = getDb();
    const insert = db.prepare(`
      INSERT INTO transactions (item_id, date, type, quantity, notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((transactions: CreateTransactionDto[]) => {
      let count = 0;
      for (const t of transactions) {
        if (t.quantity > 0) {
          insert.run(t.itemId, t.date, t.type, t.quantity, t.notes);
          count++;
        }
      }
      return count;
    });

    return insertMany(transactions);
  }
}

export const transactionRepository = new TransactionRepository();
