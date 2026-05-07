import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    // Get adjustment history for an item or all items
    const { item_id, limit = '50' } = req.query;

    let query = supabase
      .from('soh_adjustments')
      .select('*, items(name, category_id, categories(name))')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (item_id) {
      query = query.eq('item_id', parseInt(item_id as string));
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  }

  if (req.method === 'POST') {
    // Create a new SOH adjustment
    const { item_id, date, new_soh, reason } = req.body;

    if (!item_id || !date || new_soh === undefined) {
      return res.status(400).json({ error: 'item_id, date, and new_soh are required' });
    }

    // Get current SOH for the item
    const { data: item } = await supabase
      .from('items')
      .select('id, name, initial_soh')
      .eq('id', item_id)
      .single();

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Calculate current SOH (initial + all IN - all OUT + previous adjustments)
    const { data: transactions } = await supabase
      .from('transactions')
      .select('type, quantity')
      .eq('item_id', item_id)
      .lte('date', date);

    const { data: adjustments } = await supabase
      .from('soh_adjustments')
      .select('adjustment')
      .eq('item_id', item_id)
      .lte('date', date);

    let currentSoh = item.initial_soh || 0;

    for (const tx of transactions || []) {
      if (tx.type === 'IN') {
        currentSoh += tx.quantity;
      } else {
        currentSoh -= tx.quantity;
      }
    }

    for (const adj of adjustments || []) {
      currentSoh += adj.adjustment || 0;
    }

    // Create the adjustment
    const { data, error } = await supabase
      .from('soh_adjustments')
      .insert({
        item_id,
        date,
        previous_soh: currentSoh,
        new_soh,
        reason: reason || null,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
