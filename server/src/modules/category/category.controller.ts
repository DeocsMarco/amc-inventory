import { Request, Response } from 'express';
import { categoryService } from './category.service';

export class CategoryController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const categories = categoryService.getAllCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const category = categoryService.getCategoryById(id);
      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, sortOrder } = req.body;
      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      const category = categoryService.createCategory(name, sortOrder);
      res.status(201).json(category);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const { name, sortOrder } = req.body;
      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      const category = categoryService.updateCategory(id, name, sortOrder);
      res.json(category);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      categoryService.deleteCategory(id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}

export const categoryController = new CategoryController();
