import { getDb } from '../../database';
import type { Item, ItemWithCategory, CreateItemDto, UpdateItemDto } from '@amc/shared';

export class InventoryRepository {
  findAll(categoryId?: number): ItemWithCategory[] {
    const db = getDb();
    let query = `
      SELECT
        i.id, i.category_id as categoryId, i.name,
        i.qty_per_unit as qtyPerUnit, i.unit,
        i.initial_soh as initialSoh, i.is_active as isActive,
        i.created_at as createdAt,
        c.name as categoryName
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.is_active = 1
    `;

    if (categoryId) {
      query += ` AND i.category_id = ?`;
      return db.prepare(query + ' ORDER BY c.sort_order, i.name').all(categoryId) as ItemWithCategory[];
    }

    return db.prepare(query + ' ORDER BY c.sort_order, i.name').all() as ItemWithCategory[];
  }

  findById(id: number): ItemWithCategory | undefined {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        i.id, i.category_id as categoryId, i.name,
        i.qty_per_unit as qtyPerUnit, i.unit,
        i.initial_soh as initialSoh, i.is_active as isActive,
        i.created_at as createdAt,
        c.name as categoryName
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.id = ?
    `).get(id) as ItemWithCategory | undefined;
    return row;
  }

  findByName(name: string): Item | undefined {
    const db = getDb();
    return db.prepare(`
      SELECT id, category_id as categoryId, name,
        qty_per_unit as qtyPerUnit, unit,
        initial_soh as initialSoh, is_active as isActive,
        created_at as createdAt
      FROM items WHERE name = ?
    `).get(name) as Item | undefined;
  }

  create(dto: CreateItemDto): Item {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO items (category_id, name, qty_per_unit, unit, initial_soh)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      dto.categoryId,
      dto.name,
      dto.qtyPerUnit ?? 1,
      dto.unit ?? 'PC',
      dto.initialSoh ?? 0
    );

    return this.findById(result.lastInsertRowid as number) as Item;
  }

  update(id: number, dto: UpdateItemDto): Item | undefined {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return undefined;

    db.prepare(`
      UPDATE items SET
        category_id = COALESCE(?, category_id),
        name = COALESCE(?, name),
        qty_per_unit = COALESCE(?, qty_per_unit),
        unit = COALESCE(?, unit),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      dto.categoryId,
      dto.name,
      dto.qtyPerUnit,
      dto.unit,
      dto.isActive !== undefined ? (dto.isActive ? 1 : 0) : undefined,
      id
    );

    return this.findById(id);
  }

  delete(id: number): boolean {
    const db = getDb();
    const result = db.prepare('UPDATE items SET is_active = 0 WHERE id = ?').run(id);
    return result.changes > 0;
  }

  bulkCreate(items: CreateItemDto[]): number {
    const db = getDb();
    const insert = db.prepare(`
      INSERT INTO items (category_id, name, qty_per_unit, unit, initial_soh)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: CreateItemDto[]) => {
      let count = 0;
      for (const item of items) {
        insert.run(
          item.categoryId,
          item.name,
          item.qtyPerUnit ?? 1,
          item.unit ?? 'PC',
          item.initialSoh ?? 0
        );
        count++;
      }
      return count;
    });

    return insertMany(items);
  }
}

export const inventoryRepository = new InventoryRepository();
