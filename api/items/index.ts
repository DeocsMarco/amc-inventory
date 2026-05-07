import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, UNITS_PER_LOT } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const { categoryId, withSoh } = req.query;

      let query = supabase
        .from('items')
        .select(`
          id, category_id, name, qty_per_unit, unit, initial_soh, is_active, created_at,
          categories(name)
        `)
        .eq('is_active', true)
        .order('name');

      if (categoryId) {
        query = query.eq('category_id', parseInt(categoryId as string));
      }

      const { data: items, error } = await query;
      if (error) throw error;

      if (withSoh === 'true') {
        // Get transaction totals for each item
        const { data: totals, error: totalsError } = await supabase
          .from('transactions')
          .select('item_id, type, quantity');

        if (totalsError) throw totalsError;

        // Calculate totals per item
        const itemTotals = new Map<number, { totalIn: number; totalOut: number }>();
        for (const t of totals || []) {
          const current = itemTotals.get(t.item_id) || { totalIn: 0, totalOut: 0 };
          if (t.type === 'IN') {
            current.totalIn += t.quantity;
          } else {
            current.totalOut += t.quantity;
          }
          itemTotals.set(t.item_id, current);
        }

        const result = items.map((item: any) => {
          const totals = itemTotals.get(item.id) || { totalIn: 0, totalOut: 0 };
          const currentSoh = item.initial_soh + totals.totalIn - totals.totalOut;
          const lotsCovered = Math.floor((currentSoh / item.qty_per_unit) / UNITS_PER_LOT * 10) / 10;

          return {
            id: item.id,
            categoryId: item.category_id,
            name: item.name,
            qtyPerUnit: item.qty_per_unit,
            unit: item.unit,
            initialSoh: item.initial_soh,
            isActive: item.is_active,
            createdAt: item.created_at,
            categoryName: item.categories?.name || '',
            currentSoh,
            lotsCovered,
          };
        });

        return res.json(result);
      }

      const result = items.map((item: any) => ({
        id: item.id,
        categoryId: item.category_id,
        name: item.name,
        qtyPerUnit: item.qty_per_unit,
        unit: item.unit,
        initialSoh: item.initial_soh,
        isActive: item.is_active,
        createdAt: item.created_at,
        categoryName: item.categories?.name || '',
      }));

      return res.json(result);
    }

    if (req.method === 'POST') {
      const { categoryId, name, qtyPerUnit, unit, initialSoh } = req.body;

      if (!categoryId || !name) {
        return res.status(400).json({ error: 'categoryId and name are required' });
      }

      const { data, error } = await supabase
        .from('items')
        .insert({
          category_id: categoryId,
          name,
          qty_per_unit: qtyPerUnit || 1,
          unit: unit || 'PC',
          initial_soh: initialSoh || 0,
        })
        .select(`*, categories(name)`)
        .single();

      if (error) throw error;

      return res.status(201).json({
        id: data.id,
        categoryId: data.category_id,
        name: data.name,
        qtyPerUnit: data.qty_per_unit,
        unit: data.unit,
        initialSoh: data.initial_soh,
        isActive: data.is_active,
        createdAt: data.created_at,
        categoryName: data.categories?.name || '',
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
}
