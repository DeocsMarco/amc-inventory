import { getDb } from '../../database';
import type { Category } from '@amc/shared';

export class CategoryRepository {
  findAll(): Category[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, name, sort_order as sortOrder, created_at as createdAt
      FROM categories
      ORDER BY sort_order
    `).all() as Category[];
    return rows;
  }

  findById(id: number): Category | undefined {
    const db = getDb();
    const row = db.prepare(`
      SELECT id, name, sort_order as sortOrder, created_at as createdAt
      FROM categories
      WHERE id = ?
    `).get(id) as Category | undefined;
    return row;
  }

  findByName(name: string): Category | undefined {
    const db = getDb();
    const row = db.prepare(`
      SELECT id, name, sort_order as sortOrder, created_at as createdAt
      FROM categories
      WHERE name = ?
    `).get(name) as Category | undefined;
    return row;
  }

  create(name: string, sortOrder?: number): Category {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO categories (name, sort_order)
      VALUES (?, ?)
    `).run(name, sortOrder ?? 0);

    return this.findById(result.lastInsertRowid as number)!;
  }

  update(id: number, name: string, sortOrder?: number): Category | undefined {
    const db = getDb();
    db.prepare(`
      UPDATE categories SET name = ?, sort_order = ?
      WHERE id = ?
    `).run(name, sortOrder ?? 0, id);

    return this.findById(id);
  }

  delete(id: number): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return result.changes > 0;
  }
}

export const categoryRepository = new CategoryRepository();
