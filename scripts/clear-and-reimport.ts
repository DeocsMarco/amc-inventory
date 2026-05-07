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

  console.log('=== STEP 1: Clear existing data ===');

  // Delete in order: transactions -> items (keep categories)
  console.log('Deleting transactions...');
  const { error: txErr } = await supabase.from('transactions').delete().neq('id', 0);
  if (txErr) console.error('Error deleting transactions:', txErr);
  else console.log('Transactions deleted.');

  console.log('Deleting items...');
  const { error: itemErr } = await supabase.from('items').delete().neq('id', 0);
  if (itemErr) console.error('Error deleting items:', itemErr);
  else console.log('Items deleted.');

  console.log('\n=== STEP 2: Parse Excel file ===');
  console.log('Reading file:', filePath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  console.log('Sheets found:', workbook.worksheets.map(ws => ws.name));

  const allItems: ParsedItem[] = [];
  const allTransactions: ParsedTransaction[] = [];
  const categoriesFound = new Set<string>();

  for (const worksheet of workbook.worksheets) {
    console.log(`\nProcessing sheet: ${worksheet.name}`);

    let currentCategory = '';

    // Parse dates from row 8
    const dates: { col: number; date: string }[] = [];
    for (let col = 9; col <= 42; col++) {
      const cell = worksheet.getCell(8, col);
      if (cell.value instanceof Date) {
        dates.push({ col, date: formatDate(cell.value) });
      }
    }

    if (dates.length === 0) {
      console.log('  No dates found, skipping sheet.');
      continue;
    }

    console.log(`  Found ${dates.length} dates`);

    let itemCount = 0;
    let row = 9;

    while (row <= worksheet.rowCount) {
      const cellA = worksheet.getCell(row, 1).value;
      const cellE = worksheet.getCell(row, 5).value;
      const cellF = worksheet.getCell(row, 6).value;
      const cellG = worksheet.getCell(row, 7).value;
      const cellH = worksheet.getCell(row, 8).value;

      const nameValue = cellA?.toString().trim() || '';
      const cellHValue = cellH?.toString().trim().toUpperCase() || '';

      // Check if category header (H is empty, A is a category name)
      if (nameValue && CATEGORY_NAMES.includes(nameValue) && !cellHValue) {
        currentCategory = nameValue;
        categoriesFound.add(currentCategory);
        row++;
        continue;
      }

      // Check if item row (H = 'IN')
      if (nameValue && cellHValue === 'IN') {
        const qtyPerUnit = parseFloat(cellE?.toString() || '1') || 1;
        const unit = cellF?.toString() || 'PC';
        const initialSoh = parseFloat(cellG?.toString() || '0') || 0;

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

    console.log(`  Items found: ${itemCount}`);
  }

  console.log('\n=== STEP 3: Summary ===');
  console.log(`Categories found: ${Array.from(categoriesFound).join(', ')}`);
  console.log(`Total items: ${allItems.length}`);
  console.log(`Total transactions: ${allTransactions.length}`);

  // Show category breakdown
  const categoryBreakdown: Record<string, number> = {};
  for (const item of allItems) {
    categoryBreakdown[item.category] = (categoryBreakdown[item.category] || 0) + 1;
  }
  console.log('\nItems per category:');
  for (const [cat, count] of Object.entries(categoryBreakdown)) {
    console.log(`  ${cat}: ${count}`);
  }

  console.log('\n=== STEP 4: Import to Supabase ===');

  // Get existing categories
  const { data: existingCategories } = await supabase.from('categories').select('id, name');
  const categoryMap = new Map<string, number>();
  for (const cat of existingCategories || []) {
    categoryMap.set(cat.name, cat.id);
  }

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

  // Insert items
  console.log(`Creating ${allItems.length} items...`);
  const itemMap = new Map<string, number>();

  const { data: insertedItems, error: insertError } = await supabase
    .from('items')
    .insert(allItems.map(item => ({
      name: item.name,
      category_id: categoryMap.get(item.category) || categoryMap.get('MISCELLANEOUS') || 1,
      qty_per_unit: item.qtyPerUnit,
      unit: item.unit,
      initial_soh: item.initialSoh,
    })))
    .select();

  if (insertError) {
    console.error('Error inserting items:', insertError);
    return;
  }

  if (insertedItems) {
    for (const item of insertedItems) {
      itemMap.set(item.name, item.id);
    }
    console.log(`Created ${insertedItems.length} items`);
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
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Categories: ${newCategories.length} created, ${categoryMap.size - newCategories.length} existing`);
  console.log(`Items: ${allItems.length} created`);
  console.log(`Transactions: ${totalInserted} created`);
}

main().catch(console.error);
