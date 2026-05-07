import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, UNITS_PER_LOT } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    // Get counts
    const { count: totalItems } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: totalCategories } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true });

    // Get items with initial SOH
    const { data: items } = await supabase
      .from('items')
      .select('id, initial_soh, qty_per_unit')
      .eq('is_active', true);

    // Get all transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('item_id, type, quantity, date');

    // Calculate totals
    let totalCurrentSoh = 0;
    let lowStockItems = 0;
    let todayIn = 0;
    let todayOut = 0;

    const itemTotals = new Map<number, { totalIn: number; totalOut: number }>();

    for (const t of transactions || []) {
      const current = itemTotals.get(t.item_id) || { totalIn: 0, totalOut: 0 };
      if (t.type === 'IN') {
        current.totalIn += t.quantity;
        if (t.date === today) todayIn += t.quantity;
      } else {
        current.totalOut += t.quantity;
        if (t.date === today) todayOut += t.quantity;
      }
      itemTotals.set(t.item_id, current);
    }

    for (const item of items || []) {
      const totals = itemTotals.get(item.id) || { totalIn: 0, totalOut: 0 };
      const currentSoh = item.initial_soh + totals.totalIn - totals.totalOut;
      totalCurrentSoh += currentSoh;
      if (currentSoh < 100) lowStockItems++;
    }

    const totalLotsCovered = Math.floor(totalCurrentSoh / UNITS_PER_LOT * 10) / 10;

    return res.json({
      totalItems: totalItems || 0,
      totalCategories: totalCategories || 0,
      totalCurrentSoh,
      totalLotsCovered,
      lowStockItems,
      todayIn,
      todayOut,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
}
