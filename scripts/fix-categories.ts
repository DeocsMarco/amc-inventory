import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // These are items, not categories - remove them from categories table
  const badCategoryNames = [
    'PALBOND PB-N144R',
    'ACCELARATOR AC-131',
    'FINE CLEANER 4349'
  ];

  console.log('Removing incorrect categories...');

  for (const name of badCategoryNames) {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('name', name);

    if (error) {
      console.log(`  Error deleting "${name}":`, error.message);
    } else {
      console.log(`  Deleted: ${name}`);
    }
  }

  // Verify
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('id');

  console.log('\n=== Remaining Categories ===');
  for (const cat of categories || []) {
    console.log(`  ${cat.id}: ${cat.name}`);
  }
}

main().catch(console.error);
