import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, sort_order, created_at')
        .order('sort_order');

      if (error) throw error;

      const categories = data.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sort_order,
        createdAt: c.created_at,
      }));

      return res.json(categories);
    }

    if (req.method === 'POST') {
      const { name, sortOrder } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const { data, error } = await supabase
        .from('categories')
        .insert({ name, sort_order: sortOrder || 0 })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        id: data.id,
        name: data.name,
        sortOrder: data.sort_order,
        createdAt: data.created_at,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
}
