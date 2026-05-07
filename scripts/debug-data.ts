import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('=== Checking Database ===\n');

  // Get all items with their categories
  const { data: items } = await supabase
    .from('items')
    .select('id, name, category_id, categories(name)')
    .order('name');

  console.log('Items with suspicious names:');
  for (const item of items || []) {
    const name = item.name;
    if (name.includes('[object') || name.includes('Object') || name.length < 3) {
      console.log(`  ID ${item.id}: "${name}" (category: ${(item.categories as any)?.name})`);
    }
  }

  console.log('\n\nAll items by category:');
  const byCategory: Record<string, string[]> = {};
  for (const item of items || []) {
    const catName = (item.categories as any)?.name || 'UNKNOWN';
    if (!byCategory[catName]) byCategory[catName] = [];
    byCategory[catName].push(item.name);
  }

  for (const [cat, itemNames] of Object.entries(byCategory)) {
    console.log(`\n${cat} (${itemNames.length} items):`);
    for (const name of itemNames) {
      console.log(`  - ${name}`);
    }
  }

  console.log('\n\n=== Checking Excel File ===\n');

  const filePath = path.join(__dirname, '..', 'DAILY INVENTORY _ MONITORING.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const ws = workbook.worksheets[0];

  // Check for merged cells or complex cell values
  console.log('Checking first 50 rows for complex cell values:\n');
  for (let row = 9; row <= 60; row++) {
    const cellA = ws.getCell(row, 1);
    const rawValue = cellA.value;
    const cellH = ws.getCell(row, 8).value;

    // Check if value is an object (not string, number, or Date)
    if (rawValue !== null && rawValue !== undefined) {
      const valueType = typeof rawValue;
      const isObject = valueType === 'object' && !(rawValue instanceof Date);

      if (isObject) {
        console.log(`Row ${row}: Complex value detected`);
        console.log(`  Raw value:`, JSON.stringify(rawValue, null, 2));
        console.log(`  H column:`, cellH);
      }
    }
  }

  // Also check what CATEGORY_NAMES items actually look like in the Excel
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

  console.log('\n\nChecking which CATEGORY_NAMES appear as items (have IN marker):\n');
  for (let row = 9; row <= 300; row++) {
    const cellA = ws.getCell(row, 1).value;
    const cellH = ws.getCell(row, 8).value;
    const nameValue = cellA?.toString().trim() || '';
    const hValue = cellH?.toString().trim().toUpperCase() || '';

    if (CATEGORY_NAMES.includes(nameValue) && hValue === 'IN') {
      console.log(`Row ${row}: "${nameValue}" has IN marker - this is an ITEM, not a category!`);
      const cellE = ws.getCell(row, 5).value;
      const cellF = ws.getCell(row, 6).value;
      const cellG = ws.getCell(row, 7).value;
      console.log(`  E=${cellE}, F=${cellF}, G=${cellG}, H=${hValue}`);
    }
  }
}

main().catch(console.error);
