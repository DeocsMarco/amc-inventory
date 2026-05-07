import ExcelJS from 'exceljs';
import path from 'path';

async function debug() {
  const filePath = path.join(__dirname, '..', 'DAILY INVENTORY _ MONITORING.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const ws = workbook.worksheets[0]; // June sheet
  console.log('=== DEBUGGING JUNE SHEET ===');
  console.log('Sheet name:', ws.name);

  // Check row 8 for dates
  console.log('\n--- Row 8 (Date Header) ---');
  for (let col = 1; col <= 12; col++) {
    const cell = ws.getCell(8, col);
    const val = cell.value;
    console.log(`Col ${col}:`, val, `(${typeof val})`);
  }

  // Check rows 9-30 for structure
  console.log('\n--- Rows 9-30 (Items) ---');
  for (let row = 9; row <= 30; row++) {
    const a = ws.getCell(row, 1).value;
    const e = ws.getCell(row, 5).value;
    const f = ws.getCell(row, 6).value;
    const g = ws.getCell(row, 7).value;
    const h = ws.getCell(row, 8).value;
    const i = ws.getCell(row, 9).value;

    console.log(`Row ${row}: A="${a}" E=${e} F=${f} G=${g} H=${h} I=${i}`);
  }
}

debug().catch(console.error);
