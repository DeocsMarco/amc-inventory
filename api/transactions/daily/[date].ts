import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    // Get items with their transactions for this date
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select(`
        id, name, unit,
        categories(name)
      `)
      .eq('is_active', true);

    if (itemsError) throw itemsError;

    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('item_id, type, quantity')
      .eq('date', date as string);

    if (transError) throw transError;

    // Group transactions by item
    const itemTransactions = new Map<number, { inQty: number; outQty: number }>();
    for (const t of transactions || []) {
      const current = itemTransactions.get(t.item_id) || { inQty: 0, outQty: 0 };
      if (t.type === 'IN') {
        current.inQty += t.quantity;
      } else {
        current.outQty += t.quantity;
      }
      itemTransactions.set(t.item_id, current);
    }

    // Only return items with movement
    const result = items
      .filter((item: any) => itemTransactions.has(item.id))
      .map((item: any) => {
        const trans = itemTransactions.get(item.id)!;
        return {
          itemId: item.id,
          itemName: item.name,
          unit: item.unit,
          categoryName: item.categories?.name || '',
          inQty: trans.inQty,
          outQty: trans.outQty,
        };
      });

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
}
