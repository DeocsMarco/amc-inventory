import { getDb, closeDb } from './index';

const defaultCategories = [
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

const defaultSectionLots = [
  { section_name: 'TRIM', lot_number: 849 },
  { section_name: 'METAL', lot_number: 852 },
  { section_name: 'DECKING', lot_number: 848 },
  { section_name: 'PDI', lot_number: 846 },
];

export function seedDatabase(): void {
  const db = getDb();

  console.log('Seeding database...');

  // Seed categories
  const insertCategory = db.prepare(
    'INSERT OR IGNORE INTO categories (name, sort_order) VALUES (?, ?)'
  );

  const categoryTransaction = db.transaction(() => {
    defaultCategories.forEach((name, index) => {
      insertCategory.run(name, index);
    });
  });
  categoryTransaction();
  console.log(`Seeded ${defaultCategories.length} categories`);

  // Seed section lots
  const insertSectionLot = db.prepare(
    'INSERT OR IGNORE INTO section_lots (section_name, lot_number) VALUES (?, ?)'
  );

  const sectionTransaction = db.transaction(() => {
    defaultSectionLots.forEach((lot) => {
      insertSectionLot.run(lot.section_name, lot.lot_number);
    });
  });
  sectionTransaction();
  console.log(`Seeded ${defaultSectionLots.length} section lots`);

  console.log('Database seeding complete!');
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
  closeDb();
}
