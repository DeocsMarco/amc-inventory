import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import type { CreateItemDto, CreateTransactionDto } from '@amc/shared';

interface ParsedItem {
  name: string;
  category: string;
  qtyPerUnit: number;
  unit: string;
  initialSoh: number;
}

interface ParsedTransaction {
  itemName: string;
  date: string;
  type: 'IN' | 'OUT';
  quantity: number;
}

interface ParseResult {
  items: ParsedItem[];
  transactions: ParsedTransaction[];
  categories: string[];
  month: string;
  year: number;
}

const CATEGORY_NAMES = [
  'METAL COMPONENTS',
  'TRIM PARTS',
  'DOOR COMPONENTS / PLASTICS',
  'ELECTRICAL',
  'STICKERS / EMBLEM',
  'HARDWARES',
  'SHOP SUPPLIES',
  'PALBOND PB-N144R',
  'ACCELARATOR AC-131',
  'FINE CLEANER 4349',
  'WELDING CONSUMABLE',
  'HAND TAPS',
  'DISCS / BLADES',
  'MISCELLANEOUS',
];

export class XlsxParser {
  async parseFile(filePath: string): Promise<ParseResult[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const results: ParseResult[] = [];

    for (const worksheet of workbook.worksheets) {
      const sheetResult = this.parseSheet(worksheet);
      if (sheetResult.items.length > 0) {
        results.push(sheetResult);
      }
    }

    return results;
  }

  private parseSheet(worksheet: ExcelJS.Worksheet): ParseResult {
    const items: ParsedItem[] = [];
    const transactions: ParsedTransaction[] = [];
    const categories = new Set<string>();

    let currentCategory = '';
    const monthName = worksheet.name.trim();

    // Find date row (row 8) and extract dates
    const dateRow = 8;
    const dates: { col: number; date: string }[] = [];

    // Columns I (9) through AM (39) contain dates
    for (let col = 9; col <= 39; col++) {
      const cell = worksheet.getCell(dateRow, col);
      if (cell.value instanceof Date) {
        dates.push({
          col,
          date: format(cell.value, 'yyyy-MM-dd'),
        });
      }
    }

    // Extract year from first date
    const year = dates.length > 0 ? parseInt(dates[0].date.substring(0, 4)) : new Date().getFullYear();

    // Parse items starting from row 9
    let row = 9;
    while (row <= worksheet.rowCount) {
      const cellA = worksheet.getCell(row, 1).value;
      const cellE = worksheet.getCell(row, 5).value; // Qty per unit
      const cellF = worksheet.getCell(row, 6).value; // Unit
      const cellG = worksheet.getCell(row, 7).value; // SOH
      const cellH = worksheet.getCell(row, 8).value; // IN/OUT

      const nameValue = cellA?.toString().trim() || '';

      // Check if this is a category header
      if (nameValue && !cellE && !cellF && CATEGORY_NAMES.includes(nameValue)) {
        currentCategory = nameValue;
        categories.add(currentCategory);
        row++;
        continue;
      }

      // Check if this is an item row (has name, unit info, and "IN" marker)
      if (nameValue && cellH?.toString().toUpperCase() === 'IN') {
        const qtyPerUnit = parseFloat(cellE?.toString() || '1') || 1;
        const unit = cellF?.toString() || 'PC';
        const initialSoh = parseFloat(cellG?.toString() || '0') || 0;

        items.push({
          name: nameValue,
          category: currentCategory || 'MISCELLANEOUS',
          qtyPerUnit,
          unit,
          initialSoh,
        });

        // Parse IN transactions for this row
        for (const { col, date } of dates) {
          const inValue = worksheet.getCell(row, col).value;
          const quantity = parseFloat(inValue?.toString() || '0') || 0;
          if (quantity > 0) {
            transactions.push({
              itemName: nameValue,
              date,
              type: 'IN',
              quantity,
            });
          }
        }

        // Check next row for OUT transactions
        const nextRow = row + 1;
        const nextCellH = worksheet.getCell(nextRow, 8).value;
        if (nextCellH?.toString().toUpperCase() === 'OUT') {
          for (const { col, date } of dates) {
            const outValue = worksheet.getCell(nextRow, col).value;
            const quantity = parseFloat(outValue?.toString() || '0') || 0;
            if (quantity > 0) {
              transactions.push({
                itemName: nameValue,
                date,
                type: 'OUT',
                quantity,
              });
            }
          }
          row++; // Skip OUT row
        }
      }

      row++;
    }

    return {
      items,
      transactions,
      categories: Array.from(categories),
      month: monthName,
      year,
    };
  }
}

export const xlsxParser = new XlsxParser();
