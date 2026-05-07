import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import ExcelJS from 'exceljs';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60, // Max duration (Pro plan: 60s, Hobby: 10s)
};

const CATEGORY_NAMES = [
  'METAL COMPONENTS',
  'TRIM PARTS',
  'DOOR COMPONENTS / PLASTICS',
  'ELECTRICAL',
  'STICKERS / EMBLEM',
  'HARDWARES',
  'SHOP SUPPLIES',
  // Note: PALBOND PB-N144R, ACCELARATOR AC-131, FINE CLEANER 4349 are items, not categories
  'WELDING CONSUMABLE',
  'HAND TAPS',
  'DISCS / BLADES',
  'MISCELLANEOUS',
];

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper to extract text from cell values (handles rich text formatting)
function getCellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';

  // Handle rich text objects
  if (typeof value === 'object' && 'richText' in value) {
    return (value as { richText: { text: string }[] }).richText
      .map(part => part.text)
      .join('')
      .trim();
  }

  // Handle Date objects
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle other objects
  if (typeof value === 'object') {
    if ('text' in value) return String((value as { text: unknown }).text).trim();
    if ('result' in value) return String((value as { result: unknown }).result).trim();
    return '';
  }

  return String(value).trim();
}

async function parseFile(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = formidable({});
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!file) reject(new Error('No file uploaded'));
      resolve(file!.filepath);
    });
  });
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let filePath: string | null = null;

  try {
    filePath = await parseFile(req);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // Phase 1: Parse all data from Excel (no DB calls)
    const allItems: ParsedItem[] = [];
    const allTransactions: ParsedTransaction[] = [];
    const categoriesFound = new Set<string>();
    const sheetsProcessed: string[] = [];

    for (const worksheet of workbook.worksheets) {
      sheetsProcessed.push(worksheet.name);
      let currentCategory = '';

      // Parse dates from row 8
      const dates: { col: number; date: string }[] = [];
      for (let col = 9; col <= 39; col++) {
        const cell = worksheet.getCell(8, col);
        if (cell.value instanceof Date) {
          dates.push({ col, date: formatDate(cell.value) });
        }
      }

      if (dates.length === 0) continue;

      // Parse items starting from row 9
      let row = 9;
      while (row <= worksheet.rowCount) {
        const cellA = worksheet.getCell(row, 1).value;
        const cellE = worksheet.getCell(row, 5).value;
        const cellF = worksheet.getCell(row, 6).value;
        const cellG = worksheet.getCell(row, 7).value;
        const cellH = worksheet.getCell(row, 8).value;

        // Use getCellText to handle rich text cells properly
        const nameValue = getCellText(cellA);
        const cellHValue = getCellText(cellH).toUpperCase();

        // Check if category header
        // Category rows have the category name in A, E, and F, with H empty
        // Item rows have H = "IN"
        if (nameValue && CATEGORY_NAMES.includes(nameValue) && !cellHValue) {
          currentCategory = nameValue;
          categoriesFound.add(currentCategory);
          row++;
          continue;
        }

        // Check if item row
        if (nameValue && cellHValue === 'IN') {
          const qtyPerUnit = parseFloat(getCellText(cellE) || '1') || 1;
          const unit = getCellText(cellF) || 'PC';
          const initialSoh = parseFloat(getCellText(cellG) || '0') || 0;

          // Add item if not already in list
          if (!allItems.find(i => i.name === nameValue)) {
            allItems.push({
              name: nameValue,
              category: currentCategory || 'MISCELLANEOUS',
              qtyPerUnit,
              unit,
              initialSoh,
            });
          }

          // Parse IN transactions
          for (const { col, date } of dates) {
            const val = worksheet.getCell(row, col).value;
            const qty = parseFloat(val?.toString() || '0') || 0;
            if (qty > 0) {
              allTransactions.push({ itemName: nameValue, date, type: 'IN', quantity: qty });
            }
          }

          // Parse OUT transactions (next row)
          const nextRow = row + 1;
          if (worksheet.getCell(nextRow, 8).value?.toString().toUpperCase() === 'OUT') {
            for (const { col, date } of dates) {
              const val = worksheet.getCell(nextRow, col).value;
              const qty = parseFloat(val?.toString() || '0') || 0;
              if (qty > 0) {
                allTransactions.push({ itemName: nameValue, date, type: 'OUT', quantity: qty });
              }
            }
            row++;
          }
        }
        row++;
      }
    }

    // Cleanup file early
    if (filePath) {
      fs.unlinkSync(filePath);
      filePath = null;
    }

    // Phase 2: Get existing data from DB (2 queries)
    const [{ data: existingCategories }, { data: existingItems }] = await Promise.all([
      supabase.from('categories').select('id, name'),
      supabase.from('items').select('id, name'),
    ]);

    const categoryMap = new Map<string, number>();
    for (const cat of existingCategories || []) {
      categoryMap.set(cat.name, cat.id);
    }

    const itemMap = new Map<string, number>();
    for (const item of existingItems || []) {
      itemMap.set(item.name, item.id);
    }

    // Phase 3: Insert new categories (batch)
    const newCategories = Array.from(categoriesFound).filter(c => !categoryMap.has(c));
    let categoriesCreated = 0;
    if (newCategories.length > 0) {
      const { data } = await supabase
        .from('categories')
        .insert(newCategories.map(name => ({ name })))
        .select();
      if (data) {
        for (const cat of data) {
          categoryMap.set(cat.name, cat.id);
        }
        categoriesCreated = data.length;
      }
    }

    // Phase 4: Insert new items (batch)
    const newItems = allItems.filter(i => !itemMap.has(i.name));
    let itemsCreated = 0;
    if (newItems.length > 0) {
      const { data } = await supabase
        .from('items')
        .insert(newItems.map(item => ({
          name: item.name,
          category_id: categoryMap.get(item.category) || 1,
          qty_per_unit: item.qtyPerUnit,
          unit: item.unit,
          initial_soh: item.initialSoh,
        })))
        .select();
      if (data) {
        for (const item of data) {
          itemMap.set(item.name, item.id);
        }
        itemsCreated = data.length;
      }
    }

    // Phase 5: Insert transactions (batch in chunks of 500)
    let transactionsCreated = 0;
    const transactionsToInsert = allTransactions
      .filter(t => itemMap.has(t.itemName))
      .map(t => ({
        item_id: itemMap.get(t.itemName)!,
        date: t.date,
        type: t.type,
        quantity: t.quantity,
      }));

    // Insert in chunks to avoid payload size limits
    const chunkSize = 500;
    for (let i = 0; i < transactionsToInsert.length; i += chunkSize) {
      const chunk = transactionsToInsert.slice(i, i + chunkSize);
      const { error } = await supabase.from('transactions').insert(chunk);
      if (!error) {
        transactionsCreated += chunk.length;
      }
    }

    return res.json({
      message: 'Import successful',
      categoriesCreated,
      itemsCreated,
      itemsUpdated: allItems.length - newItems.length,
      transactionsCreated,
      sheetsProcessed,
    });
  } catch (error) {
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch {}
    }
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
}
