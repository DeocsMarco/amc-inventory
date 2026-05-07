import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, UNITS_PER_LOT } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get items with their section lots
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select(`
        id, category_id, name, qty_per_unit, unit, initial_soh, section_id,
        categories(name, sort_order),
        section_lots(id, section_name, lot_number, units_per_lot)
      `)
      .eq('is_active', true)
      .order('name');

    if (itemsError) throw itemsError;

    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('item_id, type, quantity');

    if (transError) throw transError;

    // Calculate totals per item
    const itemTotals = new Map<number, { totalIn: number; totalOut: number }>();
    for (const t of transactions || []) {
      const current = itemTotals.get(t.item_id) || { totalIn: 0, totalOut: 0 };
      if (t.type === 'IN') {
        current.totalIn += t.quantity;
      } else {
        current.totalOut += t.quantity;
      }
      itemTotals.set(t.item_id, current);
    }

    const result = items
      .sort((a: any, b: any) => {
        const sortA = a.categories?.sort_order ?? 999;
        const sortB = b.categories?.sort_order ?? 999;
        if (sortA !== sortB) return sortA - sortB;
        return a.name.localeCompare(b.name);
      })
      .map((item: any) => {
        const totals = itemTotals.get(item.id) || { totalIn: 0, totalOut: 0 };
        const currentSoh = item.initial_soh + totals.totalIn - totals.totalOut;

        // Calculate lot coverage
        const unitsPerLot = item.section_lots?.units_per_lot || UNITS_PER_LOT;
        const unitsPerItem = currentSoh / item.qty_per_unit;
        const lotsCovered = Math.floor(unitsPerItem / unitsPerLot * 10) / 10;

        // Calculate lot range if section is assigned
        const sectionLot = item.section_lots;
        let lotStart = null;
        let lotEnd = null;
        if (sectionLot && lotsCovered > 0) {
          lotStart = sectionLot.lot_number;
          lotEnd = sectionLot.lot_number + Math.floor(lotsCovered) - 1;
          if (lotEnd < lotStart) lotEnd = lotStart;
        }

        return {
          itemId: item.id,
          itemName: item.name,
          categoryId: item.category_id,
          categoryName: item.categories?.name || '',
          unit: item.unit,
          qtyPerUnit: item.qty_per_unit,
          initialSoh: item.initial_soh,
          totalIn: totals.totalIn,
          totalOut: totals.totalOut,
          currentSoh,
          lotsCovered,
          // Section lot info
          sectionId: item.section_id,
          sectionName: sectionLot?.section_name || null,
          currentLotNumber: sectionLot?.lot_number || null,
          lotStart,
          lotEnd,
        };
      });

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
}
