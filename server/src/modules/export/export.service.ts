import { xlsxBuilder } from './xlsx.builder';
import ExcelJS from 'exceljs';

export class ExportService {
  async exportMonthlyXlsx(year: number, month: number): Promise<ExcelJS.Workbook> {
    return xlsxBuilder.buildMonthlyReport(year, month);
  }
}

export const exportService = new ExportService();
