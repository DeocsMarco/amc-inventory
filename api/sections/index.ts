import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    // Get all section lots
    const { data, error } = await supabase
      .from('section_lots')
      .select('*')
      .order('section_name');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  }

  if (req.method === 'PUT') {
    // Update section lot number (increment the running lot)
    const { id, lot_number } = req.body;

    if (!id || lot_number === undefined) {
      return res.status(400).json({ error: 'id and lot_number are required' });
    }

    const { data, error } = await supabase
      .from('section_lots')
      .update({ lot_number })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
