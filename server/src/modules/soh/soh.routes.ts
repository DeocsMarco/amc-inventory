import { Router } from 'express';
import { getDb } from '../../database';

const router = Router();

// GET /api/soh - Get monthly snapshots or adjustments based on action param
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { action, year, month, item_id, limit = '50' } = req.query;

    // Monthly snapshots
    if (action === 'monthly' || !action) {
      if (!year || !month) {
        return res.status(400).json({ error: 'year and month are required' });
      }

      const snapshots = db.prepare(`
        SELECT ms.*, i.name as item_name, i.category_id, c.name as category_name
        FROM monthly_snapshots ms
        JOIN items i ON ms.item_id = i.id
        LEFT JOIN categories c ON i.category_id = c.id
        WHERE ms.year = ? AND ms.month = ?
      `).all(Number(year), Number(month));

      return res.json(snapshots);
    }

    // Adjustments
    if (action === 'adjust') {
      let query = `
        SELECT sa.*, i.name as item_name, i.category_id, c.name as category_name
        FROM soh_adjustments sa
        JOIN items i ON sa.item_id = i.id
        LEFT JOIN categories c ON i.category_id = c.id
      `;
      const params: any[] = [];

      if (item_id) {
        query += ' WHERE sa.item_id = ?';
        params.push(Number(item_id));
      }

      query += ' ORDER BY sa.created_at DESC LIMIT ?';
      params.push(Number(limit));

      const adjustments = db.prepare(query).all(...params);
      return res.json(adjustments);
    }

    return res.status(400).json({ error: 'Invalid action. Use: monthly or adjust' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/soh - Create/update monthly snapshot or adjustment
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { action } = req.query;

    // Monthly snapshot upsert
    if (action === 'monthly' || !action) {
      const { item_id, year, month, opening_soh } = req.body;

      if (!item_id || !year || !month || opening_soh === undefined) {
        return res.status(400).json({ error: 'item_id, year, month, and opening_soh are required' });
      }

      // Check if exists
      const existing = db.prepare(
        'SELECT * FROM monthly_snapshots WHERE item_id = ? AND year = ? AND month = ?'
      ).get(item_id, year, month);

      if (existing) {
        db.prepare(
          'UPDATE monthly_snapshots SET opening_soh = ? WHERE item_id = ? AND year = ? AND month = ?'
        ).run(opening_soh, item_id, year, month);
      } else {
        db.prepare(
          'INSERT INTO monthly_snapshots (item_id, year, month, opening_soh) VALUES (?, ?, ?, ?)'
        ).run(item_id, year, month, opening_soh);
      }

      const snapshot = db.prepare(
        'SELECT * FROM monthly_snapshots WHERE item_id = ? AND year = ? AND month = ?'
      ).get(item_id, year, month);

      return res.json(snapshot);
    }

    // Adjustment
    if (action === 'adjust') {
      const { item_id, date, new_soh, reason } = req.body;

      if (!item_id || !date || new_soh === undefined) {
        return res.status(400).json({ error: 'item_id, date, and new_soh are required' });
      }

      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(item_id) as any;
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // Calculate current SOH
      const transactions = db.prepare(
        'SELECT type, quantity FROM transactions WHERE item_id = ? AND date <= ?'
      ).all(item_id, date) as any[];

      let currentSoh = item.initial_soh || 0;
      for (const tx of transactions) {
        if (tx.type === 'IN') {
          currentSoh += tx.quantity;
        } else {
          currentSoh -= tx.quantity;
        }
      }

      const adjustment = new_soh - currentSoh;

      const result = db.prepare(
        'INSERT INTO soh_adjustments (item_id, date, previous_soh, new_soh, adjustment, reason) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(item_id, date, currentSoh, new_soh, adjustment, reason || null);

      const created = db.prepare('SELECT * FROM soh_adjustments WHERE id = ?').get(result.lastInsertRowid);
      return res.json(created);
    }

    // Preview
    if (action === 'preview') {
      const { item_id, year, month, new_opening_soh } = req.body;

      if (!item_id || !year || !month || new_opening_soh === undefined) {
        return res.status(400).json({ error: 'item_id, year, month, and new_opening_soh are required' });
      }

      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(item_id) as any;
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // Simplified preview - just return the values
      return res.json({
        itemId: item.id,
        itemName: item.name,
        selectedMonth: `${year}-${String(month).padStart(2, '0')}`,
        currentOpeningSoh: item.initial_soh,
        newOpeningSoh: new_opening_soh,
        difference: new_opening_soh - item.initial_soh,
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

// PUT /api/soh - Bulk update monthly snapshots
router.put('/', (req, res) => {
  try {
    const db = getDb();
    const { year, month, items } = req.body;

    if (!year || !month || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'year, month, and items array are required' });
    }

    let updated = 0;
    for (const item of items) {
      const existing = db.prepare(
        'SELECT * FROM monthly_snapshots WHERE item_id = ? AND year = ? AND month = ?'
      ).get(item.item_id, year, month);

      if (existing) {
        db.prepare(
          'UPDATE monthly_snapshots SET opening_soh = ? WHERE item_id = ? AND year = ? AND month = ?'
        ).run(item.opening_soh, item.item_id, year, month);
      } else {
        db.prepare(
          'INSERT INTO monthly_snapshots (item_id, year, month, opening_soh) VALUES (?, ?, ?, ?)'
        ).run(item.item_id, year, month, item.opening_soh);
      }
      updated++;
    }

    return res.json({ updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
