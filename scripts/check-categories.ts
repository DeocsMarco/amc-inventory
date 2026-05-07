import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // Check all categories
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('id');

  console.log('=== All Categories in Database ===');
  for (const cat of categories || []) {
    console.log(`  ${cat.id}: ${cat.name}`);
  }

  // Check items per category
  const { data: items } = await supabase
    .from('items')
    .select('id, name, category_id, categories(name)')
    .order('category_id');

  console.log('\n=== Items per Category ===');
  const byCategory: Record<string, string[]> = {};
  for (const item of items || []) {
    const catName = (item.categories as any)?.name || `Unknown (${item.category_id})`;
    if (!byCategory[catName]) byCategory[catName] = [];
    byCategory[catName].push(item.name);
  }

  for (const [cat, itemNames] of Object.entries(byCategory)) {
    console.log(`\n${cat} (${itemNames.length} items):`);
    for (const name of itemNames.slice(0, 5)) {
      console.log(`  - ${name}`);
    }
    if (itemNames.length > 5) {
      console.log(`  ... and ${itemNames.length - 5} more`);
    }
  }

  // Check if there are categories that shouldn't be categories
  const badCategories = ['PALBOND PB-N144R', 'ACCELARATOR AC-131', 'FINE CLEANER 4349'];
  console.log('\n=== Checking for bad categories ===');
  for (const name of badCategories) {
    const cat = categories?.find(c => c.name === name);
    if (cat) {
      const itemsInCat = items?.filter(i => i.category_id === cat.id);
      console.log(`"${name}" exists as category ID ${cat.id} with ${itemsInCat?.length || 0} items`);
    } else {
      console.log(`"${name}" is NOT a category (good)`);
    }
  }
}

main().catch(console.error);
