import api from './api';
import type { SectionLot } from '../types';

export interface SectionLotWithMonthly extends SectionLot {
  hasMonthlyOverride?: boolean;
}

export const sectionsService = {
  async getSections(year?: number, month?: number): Promise<SectionLotWithMonthly[]> {
    const params = year && month ? { year, month } : {};
    const { data } = await api.get('/sections', { params });
    return data.map((s: any) => ({
      id: s.id,
      sectionName: s.section_name,
      lotNumber: s.lot_number,
      unitsPerLot: s.units_per_lot,
      hasMonthlyOverride: s.has_monthly_override,
    }));
  },

  async updateLotNumber(id: number, lotNumber: number, year?: number, month?: number): Promise<SectionLot> {
    const body: any = { id, lot_number: lotNumber };
    if (year && month) {
      body.year = year;
      body.month = month;
    }
    const { data } = await api.put('/sections', body);
    return {
      id: data.id,
      sectionName: data.section_name,
      lotNumber: data.lot_number,
      unitsPerLot: data.units_per_lot,
    };
  },
};
