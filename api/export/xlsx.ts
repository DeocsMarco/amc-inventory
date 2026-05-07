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

const thinBorder: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: '000000' } };
const allBorders: Partial<ExcelJS.Borders> = {
  top: thinBorder,
  left: thinBorder,
  bottom: thinBorder,
  right: thinBorder,
};

function applyBorders(cell: ExcelJS.Cell) {
  cell.border = allBorders;
}

function styleHeaderCell(cell: ExcelJS.Cell, bgColor = 'FFD9D9D9') {
  cell.font = { bold: true, size: 10 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBorders(cell);
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
      .select('id, category_id, name, qty_per_unit, unit, initial_soh, section_id, section_lots(id, section_name, lot_number, units_per_lot)')
      .eq('is_active', true)
      .order('name');

    const { data: transactions } = await supabase
      .from('transactions')
      .select('item_id, date, type, quantity')
      .gte('date', startDate)
      .lte('date', endDate);

    const { data: sectionLots } = await supabase
      .from('section_lots')
      .select('id, section_name, lot_number, units_per_lot')
      .order('section_name');

    // Get monthly section lot overrides
    const { data: monthlySectionLots } = await supabase
      .from('monthly_section_lots')
      .select('section_id, lot_number')
      .eq('year', year)
      .eq('month', month);

    // Create a map of monthly overrides
    const monthlyLotMap = new Map<number, number>();
    for (const ml of monthlySectionLots || []) {
      monthlyLotMap.set(ml.section_id, ml.lot_number);
    }

    // Merge section lots with monthly overrides
    const effectiveSectionLots = (sectionLots || []).map((s: any) => ({
      ...s,
      lot_number: monthlyLotMap.get(s.id) ?? s.lot_number,
    }));

    // Build transaction map
    const transMap = new Map<string, number>();
    for (const t of transactions || []) {
      const key = `${t.item_id}-${t.date}-${t.type}`;
      transMap.set(key, (transMap.get(key) || 0) + t.quantity);
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(monthNames[month]);

    // Column count: Name + QTY/UNIT + UNIT + SOH + IN/OUT + days + TOTAL SOH + LOTS + SECTION + COVERAGE
    const totalCols = 5 + daysInMonth + 4;

    // Setup columns
    const columns: Partial<ExcelJS.Column>[] = [
      { key: 'name', width: 35 },
      { key: 'qtyPerUnit', width: 10 },
      { key: 'unit', width: 8 },
      { key: 'soh', width: 12 },
      { key: 'inOut', width: 6 },
    ];

    for (let day = 1; day <= daysInMonth; day++) {
      columns.push({ key: `day${day}`, width: 6 });
    }
    columns.push({ key: 'totalSoh', width: 12 });
    columns.push({ key: 'lots', width: 8 });
    columns.push({ key: 'section', width: 10 });
    columns.push({ key: 'coverage', width: 14 });

    worksheet.columns = columns;

    // Row 1: Title
    worksheet.mergeCells(1, 1, 1, totalCols);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = 'DAILY INVENTORY / MONITORING';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 25;

    // Row 2: Subtitle
    worksheet.mergeCells(2, 1, 2, totalCols);
    const subtitleCell = worksheet.getCell(2, 1);
    subtitleCell.value = `(for the month of ${monthNames[month].toUpperCase()} ${year})`;
    subtitleCell.font = { size: 12, italic: true };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 3: Section Lot Numbers for the month
    worksheet.mergeCells(3, 1, 3, totalCols);
    const sectionLotsText = effectiveSectionLots
      .map((s: any) => `${s.section_name}: Lot ${s.lot_number}`)
      .join('   |   ');
    const sectionCell = worksheet.getCell(3, 1);
    sectionCell.value = `Section Lots for ${monthNames[month]} ${year}:  ${sectionLotsText}`;
    sectionCell.font = { size: 11, bold: true, color: { argb: 'FF0066CC' } };
    sectionCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 5: Header row
    const headerRow = 5;
    const headers = ['ITEM NAME', 'QTY/UNIT', 'UNIT', 'INITIAL SOH', 'IN/OUT'];
    for (let day = 1; day <= daysInMonth; day++) {
      headers.push(String(day));
    }
    headers.push('TOTAL SOH', 'LOTS', 'SECTION', 'COVERAGE');

    for (let col = 1; col <= headers.length; col++) {
      const cell = worksheet.getCell(headerRow, col);
      cell.value = headers[col - 1];
      styleHeaderCell(cell);
    }
    worksheet.getRow(headerRow).height = 20;

    let currentRow = headerRow + 1;

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

      // Category header row
      worksheet.mergeCells(currentRow, 1, currentRow, totalCols);
      const catCell = worksheet.getCell(currentRow, 1);
      catCell.value = category.name;
      catCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      catCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      catCell.alignment = { horizontal: 'left', vertical: 'middle' };
      worksheet.getRow(currentRow).height = 18;
      currentRow++;

      for (const item of catItems) {
        const itemSection = (item as any).section_lots;
        const unitsPerLot = itemSection?.units_per_lot || UNITS_PER_LOT;

        // Get effective lot number for this item's section (with monthly override)
        const effectiveSection = itemSection
          ? effectiveSectionLots.find((s: any) => s.id === itemSection.id)
          : null;
        const effectiveLotNumber = effectiveSection?.lot_number ?? itemSection?.lot_number;

        // Calculate totals
        let totalIn = 0;
        let totalOut = 0;
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = formatDate(year, month, day);
          totalIn += transMap.get(`${item.id}-${dateStr}-IN`) || 0;
          totalOut += transMap.get(`${item.id}-${dateStr}-OUT`) || 0;
        }

        const totalSoh = item.initial_soh + totalIn - totalOut;
        const lotsCovered = Math.floor((totalSoh / item.qty_per_unit) / unitsPerLot * 10) / 10;

        // Calculate coverage range using effective (monthly) lot number
        let coverageText = '-';
        if (itemSection && lotsCovered > 0 && effectiveLotNumber) {
          const lotStart = effectiveLotNumber;
          let lotEnd = effectiveLotNumber + Math.floor(lotsCovered) - 1;
          if (lotEnd < lotStart) lotEnd = lotStart;
          coverageText = `${lotStart} - ${lotEnd}`;
        }

        // IN row
        const inRowNum = currentRow;
        worksheet.getCell(inRowNum, 1).value = item.name;
        worksheet.getCell(inRowNum, 2).value = item.qty_per_unit;
        worksheet.getCell(inRowNum, 3).value = item.unit;
        worksheet.getCell(inRowNum, 4).value = item.initial_soh;
        worksheet.getCell(inRowNum, 5).value = 'IN';
        worksheet.getCell(inRowNum, 5).font = { bold: true, color: { argb: 'FF228B22' } };

        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = formatDate(year, month, day);
          const inQty = transMap.get(`${item.id}-${dateStr}-IN`) || 0;
          const cell = worksheet.getCell(inRowNum, 5 + day);
          if (inQty > 0) {
            cell.value = inQty;
            cell.font = { color: { argb: 'FF228B22' } };
          }
          cell.alignment = { horizontal: 'center' };
          applyBorders(cell);
        }

        // Total SOH, Lots, Section, Coverage on IN row
        const totalSohCell = worksheet.getCell(inRowNum, 6 + daysInMonth);
        totalSohCell.value = totalSoh;
        totalSohCell.font = { bold: true };
        totalSohCell.alignment = { horizontal: 'right' };
        applyBorders(totalSohCell);

        const lotsCell = worksheet.getCell(inRowNum, 7 + daysInMonth);
        lotsCell.value = lotsCovered;
        lotsCell.alignment = { horizontal: 'center' };
        applyBorders(lotsCell);

        const sectionNameCell = worksheet.getCell(inRowNum, 8 + daysInMonth);
        sectionNameCell.value = itemSection?.section_name || '-';
        sectionNameCell.alignment = { horizontal: 'center' };
        applyBorders(sectionNameCell);

        const coverageCell = worksheet.getCell(inRowNum, 9 + daysInMonth);
        coverageCell.value = coverageText;
        coverageCell.alignment = { horizontal: 'center' };
        if (coverageText !== '-') {
          coverageCell.font = { bold: true, color: { argb: 'FF0066CC' } };
        }
        applyBorders(coverageCell);

        // Apply borders to IN row static cells
        for (let col = 1; col <= 5; col++) {
          const cell = worksheet.getCell(inRowNum, col);
          cell.alignment = col === 1 ? { horizontal: 'left' } : { horizontal: 'center' };
          applyBorders(cell);
        }

        currentRow++;

        // OUT row
        const outRowNum = currentRow;
        worksheet.getCell(outRowNum, 1).value = '';
        worksheet.getCell(outRowNum, 5).value = 'OUT';
        worksheet.getCell(outRowNum, 5).font = { bold: true, color: { argb: 'FFDC143C' } };

        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = formatDate(year, month, day);
          const outQty = transMap.get(`${item.id}-${dateStr}-OUT`) || 0;
          const cell = worksheet.getCell(outRowNum, 5 + day);
          if (outQty > 0) {
            cell.value = outQty;
            cell.font = { color: { argb: 'FFDC143C' } };
          }
          cell.alignment = { horizontal: 'center' };
          applyBorders(cell);
        }

        // Apply borders to OUT row static cells
        for (let col = 1; col <= 5; col++) {
          const cell = worksheet.getCell(outRowNum, col);
          cell.alignment = { horizontal: 'center' };
          applyBorders(cell);
        }
        // Empty cells for totals on OUT row
        for (let col = 6 + daysInMonth; col <= 9 + daysInMonth; col++) {
          applyBorders(worksheet.getCell(outRowNum, col));
        }

        currentRow++;
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
