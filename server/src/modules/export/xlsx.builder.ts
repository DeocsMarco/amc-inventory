import ExcelJS from 'exceljs';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { getDb } from '../../database';
import { config } from '../../config';

interface ExportData {
  categoryName: string;
  items: {
    name: string;
    qtyPerUnit: number;
    unit: string;
    initialSoh: number;
    dailyIn: Map<string, number>;
    dailyOut: Map<string, number>;
  }[];
}

export class XlsxBuilder {
  async buildMonthlyReport(year: number, month: number): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    const worksheet = workbook.addWorksheet(monthNames[month]);

    // Get date range
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // Setup columns
    const columns: Partial<ExcelJS.Column>[] = [
      { header: '', key: 'name', width: 40 },
      { header: '', key: 'col2', width: 5 },
      { header: '', key: 'col3', width: 5 },
      { header: '', key: 'col4', width: 5 },
      { header: '', key: 'qtyPerUnit', width: 8 },
      { header: 'UNIT', key: 'unit', width: 8 },
      { header: 'SOH', key: 'soh', width: 10 },
      { header: '', key: 'inOut', width: 5 },
    ];

    // Add day columns
    days.forEach((day, index) => {
      columns.push({
        header: format(day, 'd'),
        key: `day${index + 1}`,
        width: 8,
      });
    });

    // Add total columns
    columns.push({ header: 'TOTAL SOH', key: 'totalSoh', width: 12 });
    columns.push({ header: 'LOTS', key: 'lots', width: 10 });

    worksheet.columns = columns;

    // Add header rows
    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = `INVENTORY REPORT / MONITORING`;
    worksheet.getCell('A1').font = { bold: true, size: 14 };

    worksheet.mergeCells('A2:H2');
    worksheet.getCell('A2').value = `(for the month of ${monthNames[month].toUpperCase()} ${year})`;

    // Add date headers row
    const dateHeaderRow = 3;
    days.forEach((day, index) => {
      const col = 9 + index;
      worksheet.getCell(dateHeaderRow, col).value = day;
      worksheet.getCell(dateHeaderRow, col).numFmt = 'd';
    });

    // Get data from database
    const exportData = this.getExportData(year, month);

    let currentRow = 5;

    for (const category of exportData) {
      // Category header
      worksheet.getCell(currentRow, 1).value = category.categoryName;
      worksheet.getCell(currentRow, 1).font = { bold: true };
      currentRow++;

      for (const item of category.items) {
        // IN row
        worksheet.getCell(currentRow, 1).value = item.name;
        worksheet.getCell(currentRow, 5).value = item.qtyPerUnit;
        worksheet.getCell(currentRow, 6).value = item.unit;
        worksheet.getCell(currentRow, 7).value = item.initialSoh;
        worksheet.getCell(currentRow, 8).value = 'IN';

        days.forEach((day, index) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const inQty = item.dailyIn.get(dateStr) || 0;
          if (inQty > 0) {
            worksheet.getCell(currentRow, 9 + index).value = inQty;
          }
        });

        // Calculate total SOH
        const totalIn = Array.from(item.dailyIn.values()).reduce((a, b) => a + b, 0);
        const totalOut = Array.from(item.dailyOut.values()).reduce((a, b) => a + b, 0);
        const totalSoh = item.initialSoh + totalIn - totalOut;
        const lotsCovered = Math.floor((totalSoh / item.qtyPerUnit) / config.unitsPerLot * 10) / 10;

        worksheet.getCell(currentRow, 9 + days.length).value = totalSoh;
        worksheet.getCell(currentRow, 10 + days.length).value = lotsCovered;

        currentRow++;

        // OUT row
        worksheet.getCell(currentRow, 8).value = 'OUT';
        days.forEach((day, index) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const outQty = item.dailyOut.get(dateStr) || 0;
          if (outQty > 0) {
            worksheet.getCell(currentRow, 9 + index).value = outQty;
          }
        });

        currentRow++;

        // Empty separator row
        currentRow++;
      }
    }

    return workbook;
  }

  private getExportData(year: number, month: number): ExportData[] {
    const db = getDb();
    const startDate = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');

    // Get categories with items
    const categories = db.prepare(`
      SELECT DISTINCT c.id, c.name, c.sort_order
      FROM categories c
      JOIN items i ON c.id = i.category_id
      WHERE i.is_active = 1
      ORDER BY c.sort_order
    `).all() as { id: number; name: string; sort_order: number }[];

    const result: ExportData[] = [];

    for (const category of categories) {
      // Get items for this category
      const items = db.prepare(`
        SELECT id, name, qty_per_unit as qtyPerUnit, unit, initial_soh as initialSoh
        FROM items
        WHERE category_id = ? AND is_active = 1
        ORDER BY name
      `).all(category.id) as { id: number; name: string; qtyPerUnit: number; unit: string; initialSoh: number }[];

      const categoryData: ExportData = {
        categoryName: category.name,
        items: [],
      };

      for (const item of items) {
        // Get transactions for this item in the date range
        const transactions = db.prepare(`
          SELECT date, type, quantity
          FROM transactions
          WHERE item_id = ? AND date >= ? AND date <= ?
        `).all(item.id, startDate, endDate) as { date: string; type: string; quantity: number }[];

        const dailyIn = new Map<string, number>();
        const dailyOut = new Map<string, number>();

        for (const t of transactions) {
          if (t.type === 'IN') {
            dailyIn.set(t.date, (dailyIn.get(t.date) || 0) + t.quantity);
          } else {
            dailyOut.set(t.date, (dailyOut.get(t.date) || 0) + t.quantity);
          }
        }

        categoryData.items.push({
          name: item.name,
          qtyPerUnit: item.qtyPerUnit,
          unit: item.unit,
          initialSoh: item.initialSoh,
          dailyIn,
          dailyOut,
        });
      }

      result.push(categoryData);
    }

    return result;
  }
}

export const xlsxBuilder = new XlsxBuilder();
