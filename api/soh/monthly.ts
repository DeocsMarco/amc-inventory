import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    // Get monthly opening SOH for all items in a specific month
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'year and month are required' });
    }

    const { data, error } = await supabase
      .from('monthly_snapshots')
      .select('*, items(name, category_id, categories(name))')
      .eq('year', parseInt(year as string))
      .eq('month', parseInt(month as string));

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  }

  if (req.method === 'POST') {
    // Set monthly opening SOH for an item
    const { item_id, year, month, opening_soh } = req.body;

    if (!item_id || !year || !month || opening_soh === undefined) {
      return res.status(400).json({ error: 'item_id, year, month, and opening_soh are required' });
    }

    // Upsert the monthly snapshot
    const { data, error } = await supabase
      .from('monthly_snapshots')
      .upsert(
        {
          item_id,
          year,
          month,
          opening_soh,
        },
        { onConflict: 'item_id,year,month' }
      )
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  }

  if (req.method === 'PUT') {
    // Bulk update monthly opening SOH for multiple items
    const { year, month, items } = req.body;

    if (!year || !month || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'year, month, and items array are required' });
    }

    const snapshots = items.map((item: { item_id: number; opening_soh: number }) => ({
      item_id: item.item_id,
      year,
      month,
      opening_soh: item.opening_soh,
    }));

    const { data, error } = await supabase
      .from('monthly_snapshots')
      .upsert(snapshots, { onConflict: 'item_id,year,month' })
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ updated: data?.length || 0 });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
