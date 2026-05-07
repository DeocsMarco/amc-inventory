import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('=== Verification ===\n');

  // Check for [object Object]
  const { data: items } = await supabase
    .from('items')
    .select('id, name, category_id, categories(name)')
    .order('name');

  console.log('Checking for [object Object]:');
  const badItems = (items || []).filter(i => i.name.includes('[object'));
  if (badItems.length === 0) {
    console.log('  ✓ No [object Object] items found!\n');
  } else {
    console.log('  ✗ Found bad items:', badItems);
  }

  // Check for REBONDED FOAM
  const rebondedFoam = (items || []).find(i => i.name.includes('REBONDED'));
  if (rebondedFoam) {
    console.log('REBONDED FOAM item:');
    console.log(`  Name: "${rebondedFoam.name}"`);
    console.log(`  Category: ${(rebondedFoam.categories as any)?.name}\n`);
  }

  // Check categories are NOT items
  console.log('Checking PALBOND, ACCELARATOR, FINE CLEANER (should be items):');
  const chemicalItems = (items || []).filter(i =>
    i.name.includes('PALBOND') || i.name.includes('ACCELARATOR') || i.name.includes('FINE CLEANER')
  );
  for (const item of chemicalItems) {
    console.log(`  ${item.name} -> ${(item.categories as any)?.name}`);
  }

  // Count by category
  console.log('\n\nItems per category:');
  const byCategory: Record<string, number> = {};
  for (const item of items || []) {
    const catName = (item.categories as any)?.name || 'UNKNOWN';
    byCategory[catName] = (byCategory[catName] || 0) + 1;
  }

  for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  console.log(`\nTotal items: ${items?.length}`);
}

main().catch(console.error);
