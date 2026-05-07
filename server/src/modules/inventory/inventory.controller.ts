import { Request, Response } from 'express';
import { inventoryService } from './inventory.service';

export class InventoryController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const withSoh = req.query.withSoh === 'true';

      const items = withSoh
        ? inventoryService.getItemsWithSoh(categoryId)
        : inventoryService.getAllItems(categoryId);

      res.json(items);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const item = inventoryService.getItemById(id);
      if (!item) {
        res.status(404).json({ error: 'Item not found' });
        return;
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId, name, qtyPerUnit, unit, initialSoh } = req.body;
      if (!categoryId || !name) {
        res.status(400).json({ error: 'categoryId and name are required' });
        return;
      }
      const item = inventoryService.createItem({ categoryId, name, qtyPerUnit, unit, initialSoh });
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const { categoryId, name, qtyPerUnit, unit, isActive } = req.body;
      const item = inventoryService.updateItem(id, { categoryId, name, qtyPerUnit, unit, isActive });
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      inventoryService.deleteItem(id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}

export const inventoryController = new InventoryController();
