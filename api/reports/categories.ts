import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, UNITS_PER_LOT } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, sort_order')
      .order('sort_order');

    if (catError) throw catError;

    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, category_id, initial_soh')
      .eq('is_active', true);

    if (itemsError) throw itemsError;

    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('item_id, type, quantity');

    if (transError) throw transError;

    // Calculate item totals
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

    // Group by category
    const categoryStats = new Map<number, { itemCount: number; totalSoh: number }>();
    for (const item of items || []) {
      const current = categoryStats.get(item.category_id) || { itemCount: 0, totalSoh: 0 };
      const totals = itemTotals.get(item.id) || { totalIn: 0, totalOut: 0 };
      const currentSoh = item.initial_soh + totals.totalIn - totals.totalOut;

      current.itemCount++;
      current.totalSoh += currentSoh;
      categoryStats.set(item.category_id, current);
    }

    const result = categories.map((cat: any) => {
      const stats = categoryStats.get(cat.id) || { itemCount: 0, totalSoh: 0 };
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        itemCount: stats.itemCount,
        totalSoh: stats.totalSoh,
        totalLotsCovered: Math.floor(stats.totalSoh / UNITS_PER_LOT * 10) / 10,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
}
