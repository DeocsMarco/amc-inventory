import ExcelJS from 'exceljs';
import path from 'path';

async function main() {
  const filePath = path.join(__dirname, '..', 'DAILY INVENTORY _ MONITORING.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  console.log('Searching for [object Object] or complex cell values...\n');

  for (const ws of workbook.worksheets) {
    console.log(`\n=== Sheet: ${ws.name} ===`);

    for (let row = 1; row <= ws.rowCount; row++) {
      const cellA = ws.getCell(row, 1);
      const rawValue = cellA.value;

      if (rawValue === null || rawValue === undefined) continue;

      // Check if it's an object (but not Date)
      if (typeof rawValue === 'object' && !(rawValue instanceof Date)) {
        console.log(`\nRow ${row}: Complex object in column A`);
        console.log('  Type:', rawValue.constructor?.name || typeof rawValue);
        console.log('  Value:', JSON.stringify(rawValue, null, 2));
        console.log('  toString():', rawValue.toString());

        // Check if this row has an IN marker
        const cellH = ws.getCell(row, 8).value?.toString().trim().toUpperCase();
        console.log('  H column:', cellH);

        // Also show surrounding context
        const prevRow = ws.getCell(row - 1, 1).value;
        const nextRow = ws.getCell(row + 1, 1).value;
        console.log('  Previous row A:', prevRow?.toString()?.substring(0, 50));
        console.log('  Next row A:', nextRow?.toString()?.substring(0, 50));
      }

      // Also check if toString gives [object Object]
      const strValue = rawValue?.toString() || '';
      if (strValue.includes('[object Object]') || strValue.includes('[object')) {
        console.log(`\nRow ${row}: toString gives [object Object]`);
        console.log('  Raw type:', typeof rawValue);
        console.log('  Value:', JSON.stringify(rawValue, null, 2));
      }
    }
  }
}

main().catch(console.error);
