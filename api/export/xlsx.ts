import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, UNITS_PER_LOT } from '../_lib/supabase';
import ExcelJS from 'exceljs';

const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'Month must be between 1 and 12' });
    }

    const daysInMonth = getDaysInMonth(year, month);
    const startDate = formatDate(year, month, 1);
    const endDate = formatDate(year, month, daysInMonth);

    // Get categories with items
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, sort_order')
      .order('sort_order');

    const { data: items } = await supabase
      .from('items')
      .select('id, category_id, name, qty_per_unit, unit, initial_soh')
      .eq('is_active', true)
      .order('name');

    const { data: transactions } = await supabase
      .from('transactions')
      .select('item_id, date, type, quantity')
      .gte('date', startDate)
      .lte('date', endDate);

    // Build transaction map
    const transMap = new Map<string, number>();
    for (const t of transactions || []) {
      const key = `${t.item_id}-${t.date}-${t.type}`;
      transMap.set(key, (transMap.get(key) || 0) + t.quantity);
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(monthNames[month]);

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

    for (let day = 1; day <= daysInMonth; day++) {
      columns.push({ header: String(day), key: `day${day}`, width: 8 });
    }
    columns.push({ header: 'TOTAL SOH', key: 'totalSoh', width: 12 });
    columns.push({ header: 'LOTS', key: 'lots', width: 10 });

    worksheet.columns = columns;

    // Add headers
    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = 'INVENTORY REPORT / MONITORING';
    worksheet.getCell('A1').font = { bold: true, size: 14 };

    worksheet.mergeCells('A2:H2');
    worksheet.getCell('A2').value = `(for the month of ${monthNames[month].toUpperCase()} ${year})`;

    let currentRow = 5;

    // Group items by category
    const categoryItems = new Map<number, typeof items>();
    for (const item of items || []) {
      const catItems = categoryItems.get(item.category_id) || [];
      catItems.push(item);
      categoryItems.set(item.category_id, catItems);
    }

    for (const category of categories || []) {
      const catItems = categoryItems.get(category.id) || [];
      if (catItems.length === 0) continue;

      // Category header
      worksheet.getCell(currentRow, 1).value = category.name;
      worksheet.getCell(currentRow, 1).font = { bold: true };
      currentRow++;

      for (const item of catItems) {
        // IN row
        worksheet.getCell(currentRow, 1).value = item.name;
        worksheet.getCell(currentRow, 5).value = item.qty_per_unit;
        worksheet.getCell(currentRow, 6).value = item.unit;
        worksheet.getCell(currentRow, 7).value = item.initial_soh;
        worksheet.getCell(currentRow, 8).value = 'IN';

        let totalIn = 0;
        let totalOut = 0;

        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = formatDate(year, month, day);
          const inQty = transMap.get(`${item.id}-${dateStr}-IN`) || 0;
          const outQty = transMap.get(`${item.id}-${dateStr}-OUT`) || 0;
          totalIn += inQty;
          totalOut += outQty;

          if (inQty > 0) {
            worksheet.getCell(currentRow, 8 + day).value = inQty;
          }
        }

        const totalSoh = item.initial_soh + totalIn - totalOut;
        const lotsCovered = Math.floor((totalSoh / item.qty_per_unit) / UNITS_PER_LOT * 10) / 10;

        worksheet.getCell(currentRow, 9 + daysInMonth).value = totalSoh;
        worksheet.getCell(currentRow, 10 + daysInMonth).value = lotsCovered;

        currentRow++;

        // OUT row
        worksheet.getCell(currentRow, 8).value = 'OUT';
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = formatDate(year, month, day);
          const outQty = transMap.get(`${item.id}-${dateStr}-OUT`) || 0;
          if (outQty > 0) {
            worksheet.getCell(currentRow, 8 + day).value = outQty;
          }
        }

        currentRow++;
        currentRow++; // Empty row
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    const filename = `inventory_${monthNames[month]}_${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
}
