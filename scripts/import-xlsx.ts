import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

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

async function main() {
  const filePath = process.argv[2] || path.join(__dirname, '..', 'DAILY INVENTORY _ MONITORING.xlsx');

  console.log('Reading file:', filePath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  console.log('Sheets found:', workbook.worksheets.map(ws => ws.name));

  const allItems: ParsedItem[] = [];
  const allTransactions: ParsedTransaction[] = [];
  const categoriesFound = new Set<string>();

  for (const worksheet of workbook.worksheets) {
    console.log(`\n=== Processing sheet: ${worksheet.name} ===`);
    console.log(`Rows: ${worksheet.rowCount}, Columns: ${worksheet.columnCount}`);

    let currentCategory = '';

    // Debug: Print first few cells of row 8 to find dates
    console.log('Row 8 (looking for dates):');
    const dates: { col: number; date: string }[] = [];
    for (let col = 1; col <= 42; col++) {
      const cell = worksheet.getCell(8, col);
      const value = cell.value;
      if (value instanceof Date) {
        dates.push({ col, date: formatDate(value) });
        if (dates.length <= 5) {
          console.log(`  Col ${col}: ${formatDate(value)} (Date)`);
        }
      } else if (value && dates.length === 0 && col <= 15) {
        console.log(`  Col ${col}: ${value} (${typeof value})`);
      }
    }
    console.log(`Found ${dates.length} dates in row 8`);

    if (dates.length === 0) {
      console.log('WARNING: No dates found in row 8, trying to find date row...');
      // Try to find the date row
      for (let row = 1; row <= 15; row++) {
        let dateCount = 0;
        for (let col = 1; col <= 42; col++) {
          const cell = worksheet.getCell(row, col);
          if (cell.value instanceof Date) {
            dateCount++;
          }
        }
        if (dateCount > 10) {
          console.log(`  Found ${dateCount} dates in row ${row}`);
        }
      }
      continue;
    }

    // Debug: Print first few items
    let itemCount = 0;
    let row = 9;

    while (row <= worksheet.rowCount && itemCount < 200) {
      const cellA = worksheet.getCell(row, 1).value;
      const cellE = worksheet.getCell(row, 5).value;
      const cellF = worksheet.getCell(row, 6).value;
      const cellG = worksheet.getCell(row, 7).value;
      const cellH = worksheet.getCell(row, 8).value;

      const nameValue = cellA?.toString().trim() || '';
      const cellHValue = cellH?.toString().trim().toUpperCase() || '';

      // Check if category header
      // Category rows have the category name in A, E, and F, with H empty
      // Item rows have H = "IN"
      if (nameValue && CATEGORY_NAMES.includes(nameValue) && !cellHValue) {
        currentCategory = nameValue;
        categoriesFound.add(currentCategory);
        if (itemCount < 5) {
          console.log(`Category: ${nameValue}`);
        }
        row++;
        continue;
      }

      // Check if item row - look for IN marker
      if (nameValue && cellHValue === 'IN') {
        const qtyPerUnit = parseFloat(cellE?.toString() || '1') || 1;
        const unit = cellF?.toString() || 'PC';
        const initialSoh = parseFloat(cellG?.toString() || '0') || 0;

        if (itemCount < 5) {
          console.log(`Item: ${nameValue}, Cat: ${currentCategory}, Unit: ${unit}, SOH: ${initialSoh}`);
        }

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
        const nextCellH = worksheet.getCell(nextRow, 8).value?.toString().trim().toUpperCase();
        if (nextCellH === 'OUT') {
          for (const { col, date } of dates) {
            const val = worksheet.getCell(nextRow, col).value;
            const qty = parseFloat(val?.toString() || '0') || 0;
            if (qty > 0) {
              allTransactions.push({ itemName: nameValue, date, type: 'OUT', quantity: qty });
            }
          }
          row++;
        }

        itemCount++;
      }
      row++;
    }

    console.log(`Items found in ${worksheet.name}: ${itemCount}`);
  }

  console.log('\n=== Summary ===');
  console.log(`Categories found: ${Array.from(categoriesFound).join(', ')}`);
  console.log(`Total items parsed: ${allItems.length}`);
  console.log(`Total transactions parsed: ${allTransactions.length}`);

  if (allItems.length === 0) {
    console.log('\nNo items found! Check Excel structure.');
    return;
  }

  // Confirm before importing
  console.log('\nProceeding with import to Supabase...');

  // Get existing data
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

  console.log(`Existing categories: ${existingCategories?.length || 0}`);
  console.log(`Existing items: ${existingItems?.length || 0}`);

  // Insert new categories
  const newCategories = Array.from(categoriesFound).filter(c => !categoryMap.has(c));
  if (newCategories.length > 0) {
    console.log(`Creating ${newCategories.length} new categories...`);
    const { data } = await supabase
      .from('categories')
      .insert(newCategories.map(name => ({ name })))
      .select();
    if (data) {
      for (const cat of data) {
        categoryMap.set(cat.name, cat.id);
      }
    }
  }

  // Insert new items
  const newItems = allItems.filter(i => !itemMap.has(i.name));
  if (newItems.length > 0) {
    console.log(`Creating ${newItems.length} new items...`);
    const { data, error } = await supabase
      .from('items')
      .insert(newItems.map(item => ({
        name: item.name,
        category_id: categoryMap.get(item.category) || 1,
        qty_per_unit: item.qtyPerUnit,
        unit: item.unit,
        initial_soh: item.initialSoh,
      })))
      .select();
    if (error) {
      console.error('Error inserting items:', error);
    }
    if (data) {
      for (const item of data) {
        itemMap.set(item.name, item.id);
      }
      console.log(`Created ${data.length} items`);
    }
  }

  // Insert transactions
  const transactionsToInsert = allTransactions
    .filter(t => itemMap.has(t.itemName))
    .map(t => ({
      item_id: itemMap.get(t.itemName)!,
      date: t.date,
      type: t.type,
      quantity: t.quantity,
    }));

  console.log(`Inserting ${transactionsToInsert.length} transactions...`);

  const chunkSize = 500;
  let totalInserted = 0;
  for (let i = 0; i < transactionsToInsert.length; i += chunkSize) {
    const chunk = transactionsToInsert.slice(i, i + chunkSize);
    const { error } = await supabase.from('transactions').insert(chunk);
    if (error) {
      console.error(`Error inserting chunk ${i / chunkSize}:`, error);
    } else {
      totalInserted += chunk.length;
      console.log(`  Inserted ${totalInserted}/${transactionsToInsert.length}`);
    }
  }

  console.log('\n=== Import Complete ===');
  console.log(`Categories: ${newCategories.length} created`);
  console.log(`Items: ${newItems.length} created, ${allItems.length - newItems.length} existing`);
  console.log(`Transactions: ${totalInserted} created`);
}

main().catch(console.error);
