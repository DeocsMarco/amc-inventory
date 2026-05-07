import { inventoryRepository } from './inventory.repository';
import type { ItemWithCategory, ItemWithSoh, CreateItemDto, UpdateItemDto } from '@amc/shared';
import { transactionRepository } from '../transaction/transaction.repository';
import { config } from '../../config';

export class InventoryService {
  getAllItems(categoryId?: number): ItemWithCategory[] {
    return inventoryRepository.findAll(categoryId);
  }

  getItemById(id: number): ItemWithCategory | undefined {
    return inventoryRepository.findById(id);
  }

  getItemsWithSoh(categoryId?: number): ItemWithSoh[] {
    const items = inventoryRepository.findAll(categoryId);
    return items.map((item) => {
      const totals = transactionRepository.getItemTotals(item.id);
      const currentSoh = item.initialSoh + totals.totalIn - totals.totalOut;
      const lotsCovered = Math.floor((currentSoh / item.qtyPerUnit) / config.unitsPerLot * 10) / 10;

      return {
        ...item,
        currentSoh,
        lotsCovered,
      };
    });
  }

  createItem(dto: CreateItemDto): ItemWithCategory {
    // Check if item exists
    const existing = inventoryRepository.findByName(dto.name);
    if (existing) {
      throw new Error(`Item "${dto.name}" already exists`);
    }
    const created = inventoryRepository.create(dto);
    return inventoryRepository.findById(created.id)!;
  }

  updateItem(id: number, dto: UpdateItemDto): ItemWithCategory {
    const updated = inventoryRepository.update(id, dto);
    if (!updated) {
      throw new Error(`Item with id ${id} not found`);
    }
    return inventoryRepository.findById(id)!;
  }

  deleteItem(id: number): void {
    const success = inventoryRepository.delete(id);
    if (!success) {
      throw new Error(`Item with id ${id} not found`);
    }
  }

  getOrCreateItem(name: string, categoryId: number, dto?: Partial<CreateItemDto>): ItemWithCategory {
    const existing = inventoryRepository.findByName(name);
    if (existing) {
      return inventoryRepository.findById(existing.id)!;
    }
    const created = inventoryRepository.create({
      name,
      categoryId,
      qtyPerUnit: dto?.qtyPerUnit,
      unit: dto?.unit,
      initialSoh: dto?.initialSoh,
    });
    return inventoryRepository.findById(created.id)!;
  }
}

export const inventoryService = new InventoryService();
