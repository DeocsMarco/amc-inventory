import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { item_id, year, month, new_opening_soh } = req.body;

  if (!item_id || !year || !month || new_opening_soh === undefined) {
    return res.status(400).json({ error: 'item_id, year, month, and new_opening_soh are required' });
  }

  try {
    // Get item info
    const { data: item } = await supabase
      .from('items')
      .select('id, name, initial_soh')
      .eq('id', item_id)
      .single();

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Get all transactions for this item
    const { data: transactions } = await supabase
      .from('transactions')
      .select('date, type, quantity')
      .eq('item_id', item_id)
      .order('date');

    // Get existing monthly snapshot for this item/month
    const { data: existingSnapshot } = await supabase
      .from('monthly_snapshots')
      .select('opening_soh')
      .eq('item_id', item_id)
      .eq('year', year)
      .eq('month', month)
      .single();

    // Calculate the start date of the selected month
    const selectedMonthStart = new Date(year, month - 1, 1);
    const selectedMonthKey = `${year}-${String(month).padStart(2, '0')}`;

    // Calculate current SOH (using initial_soh + all transactions)
    let currentSohWithoutChange = item.initial_soh || 0;
    for (const t of transactions || []) {
      if (t.type === 'IN') {
        currentSohWithoutChange += t.quantity;
      } else {
        currentSohWithoutChange -= t.quantity;
      }
    }

    // Calculate what current SOH would be with the new opening SOH
    // Logic:
    // 1. Transactions BEFORE the selected month use the original flow
    // 2. At the start of selected month, we "reset" to new_opening_soh
    // 3. Transactions FROM selected month onward are added/subtracted from new_opening_soh

    let sohBeforeSelectedMonth = item.initial_soh || 0;
    let transactionsFromSelectedMonth = 0;

    for (const t of transactions || []) {
      const txDate = new Date(t.date);
      const txMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;

      if (txMonthKey < selectedMonthKey) {
        // Transaction before selected month
        if (t.type === 'IN') {
          sohBeforeSelectedMonth += t.quantity;
        } else {
          sohBeforeSelectedMonth -= t.quantity;
        }
      } else {
        // Transaction from selected month onward
        if (t.type === 'IN') {
          transactionsFromSelectedMonth += t.quantity;
        } else {
          transactionsFromSelectedMonth -= t.quantity;
        }
      }
    }

    // If we set the opening SOH to new_opening_soh, the current SOH would be:
    const projectedCurrentSoh = new_opening_soh + transactionsFromSelectedMonth;

    // Calculate the difference
    const difference = projectedCurrentSoh - currentSohWithoutChange;

    return res.json({
      itemId: item.id,
      itemName: item.name,
      selectedMonth: `${year}-${String(month).padStart(2, '0')}`,
      currentOpeningSoh: existingSnapshot?.opening_soh ?? sohBeforeSelectedMonth,
      newOpeningSoh: new_opening_soh,
      currentSohNow: currentSohWithoutChange,
      projectedSohAfterChange: projectedCurrentSoh,
      difference,
      transactionsAfterMonth: transactionsFromSelectedMonth,
      warning: difference !== 0
        ? `Changing opening SOH will ${difference > 0 ? 'increase' : 'decrease'} current stock by ${Math.abs(difference).toLocaleString()}`
        : 'No change to current stock',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
}
