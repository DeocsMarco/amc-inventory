import api from './api';
import type { Category, ItemWithCategory, ItemWithSoh, CreateItemDto } from '../types';

export const inventoryService = {
  // Categories
  async getCategories(): Promise<Category[]> {
    const { data } = await api.get('/categories');
    return data;
  },

  // Items
  async getItems(categoryId?: number): Promise<ItemWithCategory[]> {
    const params = categoryId ? { categoryId } : {};
    const { data } = await api.get('/items', { params });
    return data;
  },

  async getItemsWithSoh(categoryId?: number): Promise<ItemWithSoh[]> {
    const params = { withSoh: 'true', ...(categoryId && { categoryId }) };
    const { data } = await api.get('/items', { params });
    return data;
  },

  async getItem(id: number): Promise<ItemWithCategory> {
    const { data } = await api.get(`/items/${id}`);
    return data;
  },

  async createItem(dto: CreateItemDto): Promise<ItemWithCategory> {
    const { data } = await api.post('/items', dto);
    return data;
  },

  async updateItem(id: number, dto: Partial<CreateItemDto & { sectionId?: number | null }>): Promise<ItemWithCategory> {
    const { data } = await api.put('/items', { id, ...dto });
    return data;
  },

  async deleteItem(id: number): Promise<void> {
    await api.delete(`/items/${id}`);
  },
};
