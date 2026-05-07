import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;

  try {
    // Monthly SOH operations
    if (action === 'monthly' || !action) {
      return handleMonthly(req, res);
    }

    // Adjustment operations
    if (action === 'adjust') {
      return handleAdjust(req, res);
    }

    // Preview operations
    if (action === 'preview') {
      return handlePreview(req, res);
    }

    return res.status(400).json({ error: 'Invalid action. Use: monthly, adjust, or preview' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
}

async function handleMonthly(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
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
    const { item_id, year, month, opening_soh } = req.body;

    if (!item_id || !year || !month || opening_soh === undefined) {
      return res.status(400).json({ error: 'item_id, year, month, and opening_soh are required' });
    }

    const { data, error } = await supabase
      .from('monthly_snapshots')
      .upsert(
        { item_id, year, month, opening_soh },
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

async function handleAdjust(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
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
    const { item_id, date, new_soh, reason } = req.body;

    if (!item_id || !date || new_soh === undefined) {
      return res.status(400).json({ error: 'item_id, date, and new_soh are required' });
    }

    const { data: item } = await supabase
      .from('items')
      .select('id, name, initial_soh')
      .eq('id', item_id)
      .single();

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

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

async function handlePreview(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { item_id, year, month, new_opening_soh } = req.body;

  if (!item_id || !year || !month || new_opening_soh === undefined) {
    return res.status(400).json({ error: 'item_id, year, month, and new_opening_soh are required' });
  }

  const { data: item } = await supabase
    .from('items')
    .select('id, name, initial_soh')
    .eq('id', item_id)
    .single();

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const { data: transactions } = await supabase
    .from('transactions')
    .select('date, type, quantity')
    .eq('item_id', item_id)
    .order('date');

  const { data: existingSnapshot } = await supabase
    .from('monthly_snapshots')
    .select('opening_soh')
    .eq('item_id', item_id)
    .eq('year', year)
    .eq('month', month)
    .single();

  const selectedMonthKey = `${year}-${String(month).padStart(2, '0')}`;

  let currentSohWithoutChange = item.initial_soh || 0;
  for (const t of transactions || []) {
    if (t.type === 'IN') {
      currentSohWithoutChange += t.quantity;
    } else {
      currentSohWithoutChange -= t.quantity;
    }
  }

  let sohBeforeSelectedMonth = item.initial_soh || 0;
  let transactionsFromSelectedMonth = 0;

  for (const t of transactions || []) {
    const txDate = new Date(t.date);
    const txMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;

    if (txMonthKey < selectedMonthKey) {
      if (t.type === 'IN') {
        sohBeforeSelectedMonth += t.quantity;
      } else {
        sohBeforeSelectedMonth -= t.quantity;
      }
    } else {
      if (t.type === 'IN') {
        transactionsFromSelectedMonth += t.quantity;
      } else {
        transactionsFromSelectedMonth -= t.quantity;
      }
    }
  }

  const projectedCurrentSoh = new_opening_soh + transactionsFromSelectedMonth;
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
}
