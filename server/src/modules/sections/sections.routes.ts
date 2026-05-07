import { Router } from 'express';
import { getDb } from '../../database';

const router = Router();

// GET /api/sections - Get all sections with optional monthly overrides
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { year, month } = req.query;

    // Get all base section lots
    const sections = db.prepare('SELECT * FROM section_lots ORDER BY section_name').all();

    // If year and month provided, get monthly overrides
    if (year && month) {
      const monthlyLots = db.prepare(
        'SELECT * FROM monthly_section_lots WHERE year = ? AND month = ?'
      ).all(Number(year), Number(month));

      // Create a map of section_id -> monthly lot_number
      const monthlyMap = new Map<number, number>();
      for (const ml of monthlyLots as any[]) {
        monthlyMap.set(ml.section_id, ml.lot_number);
      }

      // Merge: use monthly lot_number if exists, otherwise use base
      const result = (sections as any[]).map((s) => ({
        ...s,
        lot_number: monthlyMap.get(s.id) ?? s.lot_number,
        has_monthly_override: monthlyMap.has(s.id),
      }));

      return res.json(result);
    }

    return res.json(sections);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

// PUT /api/sections - Update section lot number
router.put('/', (req, res) => {
  try {
    const db = getDb();
    const { id, lot_number, year, month } = req.body;

    if (!id || lot_number === undefined) {
      return res.status(400).json({ error: 'id and lot_number are required' });
    }

    // If year and month provided, upsert to monthly_section_lots
    if (year && month) {
      // Check if exists
      const existing = db.prepare(
        'SELECT * FROM monthly_section_lots WHERE section_id = ? AND year = ? AND month = ?'
      ).get(id, year, month);

      if (existing) {
        db.prepare(
          'UPDATE monthly_section_lots SET lot_number = ? WHERE section_id = ? AND year = ? AND month = ?'
        ).run(lot_number, id, year, month);
      } else {
        db.prepare(
          'INSERT INTO monthly_section_lots (section_id, year, month, lot_number) VALUES (?, ?, ?, ?)'
        ).run(id, year, month, lot_number);
      }

      // Return the section with updated lot number
      const section = db.prepare('SELECT * FROM section_lots WHERE id = ?').get(id);

      return res.json({
        ...section,
        lot_number,
      });
    }

    // Otherwise update base section_lots
    db.prepare('UPDATE section_lots SET lot_number = ? WHERE id = ?').run(lot_number, id);
    const section = db.prepare('SELECT * FROM section_lots WHERE id = ?').get(id);

    return res.json(section);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
