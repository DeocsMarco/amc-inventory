import { categoryRepository } from './category.repository';
import type { Category } from '@amc/shared';

export class CategoryService {
  getAllCategories(): Category[] {
    return categoryRepository.findAll();
  }

  getCategoryById(id: number): Category | undefined {
    return categoryRepository.findById(id);
  }

  createCategory(name: string, sortOrder?: number): Category {
    // Check if category already exists
    const existing = categoryRepository.findByName(name);
    if (existing) {
      throw new Error(`Category "${name}" already exists`);
    }
    return categoryRepository.create(name, sortOrder);
  }

  updateCategory(id: number, name: string, sortOrder?: number): Category {
    const existing = categoryRepository.findById(id);
    if (!existing) {
      throw new Error(`Category with id ${id} not found`);
    }
    const updated = categoryRepository.update(id, name, sortOrder);
    return updated!;
  }

  deleteCategory(id: number): void {
    const success = categoryRepository.delete(id);
    if (!success) {
      throw new Error(`Category with id ${id} not found`);
    }
  }

  getOrCreateCategory(name: string): Category {
    const existing = categoryRepository.findByName(name);
    if (existing) {
      return existing;
    }
    return categoryRepository.create(name);
  }
}

export const categoryService = new CategoryService();
