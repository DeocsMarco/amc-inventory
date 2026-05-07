import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { year, month } = req.query;

    // Get all base section lots
    const { data: sections, error } = await supabase
      .from('section_lots')
      .select('*')
      .order('section_name');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // If year and month provided, get monthly overrides
    if (year && month) {
      const { data: monthlyLots } = await supabase
        .from('monthly_section_lots')
        .select('*')
        .eq('year', parseInt(year as string))
        .eq('month', parseInt(month as string));

      // Create a map of section_id -> monthly lot_number
      const monthlyMap = new Map<number, number>();
      for (const ml of monthlyLots || []) {
        monthlyMap.set(ml.section_id, ml.lot_number);
      }

      // Merge: use monthly lot_number if exists, otherwise use base
      const result = sections.map((s: any) => ({
        ...s,
        lot_number: monthlyMap.get(s.id) ?? s.lot_number,
        has_monthly_override: monthlyMap.has(s.id),
      }));

      return res.json(result);
    }

    return res.json(sections);
  }

  if (req.method === 'PUT') {
    const { id, lot_number, year, month } = req.body;

    if (!id || lot_number === undefined) {
      return res.status(400).json({ error: 'id and lot_number are required' });
    }

    // If year and month provided, upsert to monthly_section_lots
    if (year && month) {
      const { data, error } = await supabase
        .from('monthly_section_lots')
        .upsert(
          { section_id: id, year, month, lot_number },
          { onConflict: 'section_id,year,month' }
        )
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // Return the section with updated lot number
      const { data: section } = await supabase
        .from('section_lots')
        .select('*')
        .eq('id', id)
        .single();

      return res.json({
        ...section,
        lot_number: data.lot_number,
      });
    }

    // Otherwise update base section_lots
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
