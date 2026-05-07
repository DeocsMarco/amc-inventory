import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const { itemId, date, startDate, endDate } = req.query;

      let query = supabase
        .from('transactions')
        .select(`
          id, item_id, date, type, quantity, notes, created_at,
          items(name, unit, categories(name))
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (itemId) query = query.eq('item_id', parseInt(itemId as string));
      if (date) query = query.eq('date', date as string);
      if (startDate) query = query.gte('date', startDate as string);
      if (endDate) query = query.lte('date', endDate as string);

      const { data, error } = await query;
      if (error) throw error;

      const result = data.map((t: any) => ({
        id: t.id,
        itemId: t.item_id,
        date: t.date,
        type: t.type,
        quantity: t.quantity,
        notes: t.notes,
        createdAt: t.created_at,
        itemName: t.items?.name || '',
        unit: t.items?.unit || '',
        categoryName: t.items?.categories?.name || '',
      }));

      return res.json(result);
    }

    if (req.method === 'POST') {
      const { itemId, date, type, quantity, notes } = req.body;

      if (!itemId || !date || !type || quantity === undefined) {
        return res.status(400).json({ error: 'itemId, date, type, and quantity are required' });
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          item_id: itemId,
          date,
          type,
          quantity,
          notes,
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        id: data.id,
        itemId: data.item_id,
        date: data.date,
        type: data.type,
        quantity: data.quantity,
        notes: data.notes,
        createdAt: data.created_at,
      });
    }

    if (req.method === 'PUT') {
      // Upsert transaction
      const { itemId, date, type, quantity, notes } = req.body;

      if (!itemId || !date || !type || quantity === undefined) {
        return res.status(400).json({ error: 'itemId, date, type, and quantity are required' });
      }

      // Check if exists
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('item_id', itemId)
        .eq('date', date)
        .eq('type', type)
        .single();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('transactions')
          .update({ quantity, notes })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return res.json({
          id: data.id,
          itemId: data.item_id,
          date: data.date,
          type: data.type,
          quantity: data.quantity,
          notes: data.notes,
          createdAt: data.created_at,
        });
      }

      // Insert
      const { data, error } = await supabase
        .from('transactions')
        .insert({ item_id: itemId, date, type, quantity, notes })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({
        id: data.id,
        itemId: data.item_id,
        date: data.date,
        type: data.type,
        quantity: data.quantity,
        notes: data.notes,
        createdAt: data.created_at,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
}
