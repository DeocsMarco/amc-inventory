import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import ExcelJS from 'exceljs';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

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

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let filePath: string | null = null;

  try {
    filePath = await parseFile(req);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    let categoriesCreated = 0;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let transactionsCreated = 0;
    const sheetsProcessed: string[] = [];

    // Get existing categories
    const { data: existingCategories } = await supabase.from('categories').select('id, name');
    const categoryMap = new Map<string, number>();
    for (const cat of existingCategories || []) {
      categoryMap.set(cat.name, cat.id);
    }

    // Get existing items
    const { data: existingItems } = await supabase.from('items').select('id, name');
    const itemMap = new Map<string, number>();
    for (const item of existingItems || []) {
      itemMap.set(item.name, item.id);
    }

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

      // Parse items starting from row 9
      let row = 9;
      while (row <= worksheet.rowCount) {
        const cellA = worksheet.getCell(row, 1).value;
        const cellE = worksheet.getCell(row, 5).value;
        const cellF = worksheet.getCell(row, 6).value;
        const cellG = worksheet.getCell(row, 7).value;
        const cellH = worksheet.getCell(row, 8).value;

        const nameValue = cellA?.toString().trim() || '';

        // Check if category header
        if (nameValue && !cellE && !cellF && CATEGORY_NAMES.includes(nameValue)) {
          currentCategory = nameValue;
          if (!categoryMap.has(currentCategory)) {
            const { data } = await supabase
              .from('categories')
              .insert({ name: currentCategory })
              .select()
              .single();
            if (data) {
              categoryMap.set(currentCategory, data.id);
              categoriesCreated++;
            }
          }
          row++;
          continue;
        }

        // Check if item row
        if (nameValue && cellH?.toString().toUpperCase() === 'IN') {
          const qtyPerUnit = parseFloat(cellE?.toString() || '1') || 1;
          const unit = cellF?.toString() || 'PC';
          const initialSoh = parseFloat(cellG?.toString() || '0') || 0;
          const categoryId = categoryMap.get(currentCategory || 'MISCELLANEOUS') || 1;

          let itemId = itemMap.get(nameValue);

          if (!itemId) {
            const { data } = await supabase
              .from('items')
              .insert({
                name: nameValue,
                category_id: categoryId,
                qty_per_unit: qtyPerUnit,
                unit,
                initial_soh: initialSoh,
              })
              .select()
              .single();
            if (data) {
              itemId = data.id;
              itemMap.set(nameValue, itemId);
              itemsCreated++;
            }
          } else {
            itemsUpdated++;
          }

          if (itemId) {
            // Parse IN transactions
            const inTransactions = [];
            for (const { col, date } of dates) {
              const val = worksheet.getCell(row, col).value;
              const qty = parseFloat(val?.toString() || '0') || 0;
              if (qty > 0) {
                inTransactions.push({ item_id: itemId, date, type: 'IN', quantity: qty });
              }
            }

            // Parse OUT transactions (next row)
            const outTransactions = [];
            const nextRow = row + 1;
            if (worksheet.getCell(nextRow, 8).value?.toString().toUpperCase() === 'OUT') {
              for (const { col, date } of dates) {
                const val = worksheet.getCell(nextRow, col).value;
                const qty = parseFloat(val?.toString() || '0') || 0;
                if (qty > 0) {
                  outTransactions.push({ item_id: itemId, date, type: 'OUT', quantity: qty });
                }
              }
              row++;
            }

            // Insert transactions
            const allTransactions = [...inTransactions, ...outTransactions];
            if (allTransactions.length > 0) {
              const { error } = await supabase.from('transactions').insert(allTransactions);
              if (!error) {
                transactionsCreated += allTransactions.length;
              }
            }
          }
        }

        row++;
      }
    }

    // Cleanup
    if (filePath) {
      fs.unlinkSync(filePath);
    }

    return res.json({
      message: 'Import successful',
      categoriesCreated,
      itemsCreated,
      itemsUpdated,
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
