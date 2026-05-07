import api from './api';

export interface MonthlySnapshot {
  id: number;
  item_id: number;
  year: number;
  month: number;
  opening_soh: number;
  closing_soh?: number;
  total_in?: number;
  total_out?: number;
  items?: {
    name: string;
    category_id: number;
    categories?: { name: string };
  };
}

export interface SohAdjustment {
  id: number;
  item_id: number;
  date: string;
  previous_soh: number;
  new_soh: number;
  adjustment: number;
  reason?: string;
  created_at: string;
  items?: {
    name: string;
    category_id: number;
    categories?: { name: string };
  };
}

export interface SohChangePreview {
  itemId: number;
  itemName: string;
  selectedMonth: string;
  currentOpeningSoh: number;
  newOpeningSoh: number;
  currentSohNow: number;
  projectedSohAfterChange: number;
  difference: number;
  transactionsAfterMonth: number;
  warning: string;
}

export const sohService = {
  // Get monthly snapshots for a specific month
  async getMonthlySnapshots(year: number, month: number): Promise<MonthlySnapshot[]> {
    const { data } = await api.get(`/soh/monthly?year=${year}&month=${month}`);
    return data;
  },

  // Set opening SOH for a single item in a month
  async setMonthlyOpeningSoh(
    itemId: number,
    year: number,
    month: number,
    openingSoh: number
  ): Promise<MonthlySnapshot> {
    const { data } = await api.post('/soh/monthly', {
      item_id: itemId,
      year,
      month,
      opening_soh: openingSoh,
    });
    return data;
  },

  // Bulk update monthly opening SOH
  async bulkUpdateMonthlyOpeningSoh(
    year: number,
    month: number,
    items: { item_id: number; opening_soh: number }[]
  ): Promise<{ updated: number }> {
    const { data } = await api.put('/soh/monthly', {
      year,
      month,
      items,
    });
    return data;
  },

  // Get adjustment history
  async getAdjustments(itemId?: number, limit = 50): Promise<SohAdjustment[]> {
    const params = new URLSearchParams();
    if (itemId) params.append('item_id', itemId.toString());
    params.append('limit', limit.toString());
    const { data } = await api.get(`/soh/adjust?${params}`);
    return data;
  },

  // Create a new adjustment
  async createAdjustment(
    itemId: number,
    date: string,
    newSoh: number,
    reason?: string
  ): Promise<SohAdjustment> {
    const { data } = await api.post('/soh/adjust', {
      item_id: itemId,
      date,
      new_soh: newSoh,
      reason,
    });
    return data;
  },

  // Preview the impact of changing monthly opening SOH
  async previewSohChange(
    itemId: number,
    year: number,
    month: number,
    newOpeningSoh: number
  ): Promise<SohChangePreview> {
    const { data } = await api.post('/soh/preview', {
      item_id: itemId,
      year,
      month,
      new_opening_soh: newOpeningSoh,
    });
    return data;
  },
};
