import { xlsxParser } from './xlsx.parser';
import { categoryService } from '../category/category.service';
import { inventoryService } from '../inventory/inventory.service';
import { transactionRepository } from '../transaction/transaction.repository';
import type { CreateTransactionDto } from '@amc/shared';

interface ImportResult {
  categoriesCreated: number;
  itemsCreated: number;
  itemsUpdated: number;
  transactionsCreated: number;
  sheetsProcessed: string[];
}

export class ImportService {
  async importFromXlsx(filePath: string): Promise<ImportResult> {
    const parseResults = await xlsxParser.parseFile(filePath);

    let categoriesCreated = 0;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let transactionsCreated = 0;
    const sheetsProcessed: string[] = [];

    for (const result of parseResults) {
      sheetsProcessed.push(result.month);

      // Create/get categories
      const categoryMap = new Map<string, number>();
      for (const catName of result.categories) {
        const category = categoryService.getOrCreateCategory(catName);
        categoryMap.set(catName, category.id);
        if (category.createdAt === new Date().toISOString().split('T')[0]) {
          categoriesCreated++;
        }
      }

      // Create/get items and map names to IDs
      const itemMap = new Map<string, number>();
      for (const item of result.items) {
        const categoryId = categoryMap.get(item.category) || 1;
        const existingItem = inventoryService.getAllItems().find(i => i.name === item.name);

        if (existingItem) {
          itemMap.set(item.name, existingItem.id);
          itemsUpdated++;
        } else {
          const newItem = inventoryService.createItem({
            name: item.name,
            categoryId,
            qtyPerUnit: item.qtyPerUnit,
            unit: item.unit,
            initialSoh: item.initialSoh,
          });
          itemMap.set(item.name, newItem.id);
          itemsCreated++;
        }
      }

      // Create transactions
      const transactionsToCreate: CreateTransactionDto[] = result.transactions
        .filter(t => itemMap.has(t.itemName))
        .map(t => ({
          itemId: itemMap.get(t.itemName)!,
          date: t.date,
          type: t.type,
          quantity: t.quantity,
        }));

      if (transactionsToCreate.length > 0) {
        transactionsCreated += transactionRepository.bulkCreate(transactionsToCreate);
      }
    }

    return {
      categoriesCreated,
      itemsCreated,
      itemsUpdated,
      transactionsCreated,
      sheetsProcessed,
    };
  }
}

export const importService = new ImportService();
