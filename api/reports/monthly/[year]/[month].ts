import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase';

const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { year, month } = req.query;
    const yearNum = parseInt(year as string);
    const monthNum = parseInt(month as string);

    if (!yearNum || !monthNum || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: 'Valid year and month (1-12) are required' });
    }

    const daysInMonth = getDaysInMonth(yearNum, monthNum);
    const startDate = formatDate(yearNum, monthNum, 1);
    const endDate = formatDate(yearNum, monthNum, daysInMonth);

    // Get items with initial SOH
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, initial_soh')
      .eq('is_active', true);

    if (itemsError) throw itemsError;

    // Get transactions before this month for opening stock
    const { data: priorTransactions, error: priorError } = await supabase
      .from('transactions')
      .select('item_id, type, quantity')
      .lt('date', startDate);

    if (priorError) throw priorError;

    // Get transactions for this month
    const { data: monthTransactions, error: monthError } = await supabase
      .from('transactions')
      .select('date, type, quantity')
      .gte('date', startDate)
      .lte('date', endDate);

    if (monthError) throw monthError;

    // Calculate opening stock
    let openingStock = (items || []).reduce((sum, item) => sum + item.initial_soh, 0);
    for (const t of priorTransactions || []) {
      if (t.type === 'IN') {
        openingStock += t.quantity;
      } else {
        openingStock -= t.quantity;
      }
    }

    // Calculate monthly totals and daily movements
    let totalIn = 0;
    let totalOut = 0;
    const dailyMap = new Map<string, { totalIn: number; totalOut: number }>();

    for (const t of monthTransactions || []) {
      if (t.type === 'IN') {
        totalIn += t.quantity;
      } else {
        totalOut += t.quantity;
      }

      const current = dailyMap.get(t.date) || { totalIn: 0, totalOut: 0 };
      if (t.type === 'IN') {
        current.totalIn += t.quantity;
      } else {
        current.totalOut += t.quantity;
      }
      dailyMap.set(t.date, current);
    }

    // Build daily movements array
    const dailyMovements = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDate(yearNum, monthNum, day);
      const data = dailyMap.get(dateStr) || { totalIn: 0, totalOut: 0 };
      dailyMovements.push({
        date: dateStr,
        day,
        totalIn: data.totalIn,
        totalOut: data.totalOut,
      });
    }

    const closingStock = openingStock + totalIn - totalOut;

    return res.json({
      year: yearNum,
      month: monthNum,
      monthName: monthNames[monthNum],
      openingStock,
      totalIn,
      totalOut,
      closingStock,
      dailyMovements,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
}
