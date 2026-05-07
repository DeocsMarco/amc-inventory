import api from './api';
import type { SohReport, DailySummary, CategorySummary, MonthlyReport, DashboardStats } from '../types';

export const reportService = {
  async getDashboardStats(): Promise<DashboardStats> {
    const { data } = await api.get('/reports/dashboard');
    return data;
  },

  async getSohReport(): Promise<SohReport[]> {
    const { data } = await api.get('/reports/soh');
    return data;
  },

  async getDailySummary(date: string): Promise<DailySummary> {
    const { data } = await api.get(`/reports/daily/${date}`);
    return data;
  },

  async getCategorySummary(): Promise<CategorySummary[]> {
    const { data } = await api.get('/reports/categories');
    return data;
  },

  async getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
    const { data } = await api.get(`/reports/monthly/${year}/${month}`);
    return data;
  },

  async importXlsx(file: File): Promise<{
    categoriesCreated: number;
    itemsCreated: number;
    itemsUpdated: number;
    transactionsCreated: number;
    sheetsProcessed: string[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/import/xlsx', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 minutes for large files
    });
    return data;
  },

  getExportUrl(year: number, month: number): string {
    return `/api/export/xlsx?year=${year}&month=${month}`;
  },
};
