import { getDb } from '../../database';
import { config } from '../../config';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import type {
  SohReport,
  DailySummary,
  CategorySummary,
  MonthlyReport,
  DailyMovement,
  DashboardStats,
} from '@amc/shared';

export class ReportService {
  getSohReport(): SohReport[] {
    const db = getDb();
    const items = db.prepare(`
      SELECT
        i.id as itemId,
        i.name as itemName,
        i.category_id as categoryId,
        c.name as categoryName,
        i.unit,
        i.qty_per_unit as qtyPerUnit,
        i.initial_soh as initialSoh,
        COALESCE(SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE 0 END), 0) as totalIn,
        COALESCE(SUM(CASE WHEN t.type = 'OUT' THEN t.quantity ELSE 0 END), 0) as totalOut
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN transactions t ON i.id = t.item_id
      WHERE i.is_active = 1
      GROUP BY i.id
      ORDER BY c.sort_order, i.name
    `).all() as any[];

    return items.map((item) => {
      const currentSoh = item.initialSoh + item.totalIn - item.totalOut;
      const lotsCovered = Math.floor((currentSoh / item.qtyPerUnit) / config.unitsPerLot * 10) / 10;

      return {
        ...item,
        currentSoh,
        lotsCovered,
      };
    });
  }

  getDailySummary(date: string): DailySummary {
    const db = getDb();
    const result = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END), 0) as totalIn,
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END), 0) as totalOut,
        COUNT(DISTINCT item_id) as itemsWithMovement
      FROM transactions
      WHERE date = ?
    `).get(date) as { totalIn: number; totalOut: number; itemsWithMovement: number };

    return {
      date,
      totalIn: result.totalIn,
      totalOut: result.totalOut,
      itemsWithMovement: result.itemsWithMovement,
    };
  }

  getCategorySummary(): CategorySummary[] {
    const db = getDb();
    const categories = db.prepare(`
      SELECT
        c.id as categoryId,
        c.name as categoryName,
        COUNT(DISTINCT i.id) as itemCount,
        COALESCE(SUM(
          i.initial_soh +
          COALESCE((SELECT SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END) FROM transactions WHERE item_id = i.id), 0) -
          COALESCE((SELECT SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END) FROM transactions WHERE item_id = i.id), 0)
        ), 0) as totalSoh
      FROM categories c
      LEFT JOIN items i ON c.id = i.category_id AND i.is_active = 1
      GROUP BY c.id
      ORDER BY c.sort_order
    `).all() as any[];

    return categories.map((cat) => ({
      ...cat,
      totalLotsCovered: Math.floor(cat.totalSoh / config.unitsPerLot * 10) / 10,
    }));
  }

  getMonthlyReport(year: number, month: number): MonthlyReport {
    const db = getDb();
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    const startDate = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');

    // Get opening stock (sum of initial_soh + all transactions before this month)
    const openingResult = db.prepare(`
      SELECT
        COALESCE(SUM(i.initial_soh), 0) +
        COALESCE(SUM((SELECT SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END) FROM transactions WHERE item_id = i.id AND date < ?)), 0) as openingStock
      FROM items i
      WHERE i.is_active = 1
    `).get(startDate) as { openingStock: number };

    // Get monthly totals
    const monthlyResult = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END), 0) as totalIn,
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END), 0) as totalOut
      FROM transactions
      WHERE date >= ? AND date <= ?
    `).get(startDate, endDate) as { totalIn: number; totalOut: number };

    // Get daily movements
    const dailyResults = db.prepare(`
      SELECT
        date,
        COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END), 0) as totalIn,
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END), 0) as totalOut
      FROM transactions
      WHERE date >= ? AND date <= ?
      GROUP BY date
      ORDER BY date
    `).all(startDate, endDate) as { date: string; totalIn: number; totalOut: number }[];

    // Build daily movements with all days
    const days = eachDayOfInterval({
      start: new Date(year, month - 1, 1),
      end: endOfMonth(new Date(year, month - 1)),
    });

    const dailyMap = new Map(dailyResults.map(d => [d.date, d]));
    const dailyMovements: DailyMovement[] = days.map((day, index) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const data = dailyMap.get(dateStr);
      return {
        date: dateStr,
        day: index + 1,
        totalIn: data?.totalIn || 0,
        totalOut: data?.totalOut || 0,
      };
    });

    const closingStock = openingResult.openingStock + monthlyResult.totalIn - monthlyResult.totalOut;

    return {
      year,
      month,
      monthName: monthNames[month],
      openingStock: openingResult.openingStock,
      totalIn: monthlyResult.totalIn,
      totalOut: monthlyResult.totalOut,
      closingStock,
      dailyMovements,
    };
  }

  getDashboardStats(): DashboardStats {
    const db = getDb();
    const today = format(new Date(), 'yyyy-MM-dd');

    // Get basic counts
    const counts = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM items WHERE is_active = 1) as totalItems,
        (SELECT COUNT(*) FROM categories) as totalCategories
    `).get() as { totalItems: number; totalCategories: number };

    // Get SOH totals
    const sohResult = db.prepare(`
      SELECT
        COALESCE(SUM(
          i.initial_soh +
          COALESCE((SELECT SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END) FROM transactions WHERE item_id = i.id), 0) -
          COALESCE((SELECT SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END) FROM transactions WHERE item_id = i.id), 0)
        ), 0) as totalCurrentSoh
      FROM items i
      WHERE i.is_active = 1
    `).get() as { totalCurrentSoh: number };

    // Get today's movements
    const todayResult = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END), 0) as todayIn,
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END), 0) as todayOut
      FROM transactions
      WHERE date = ?
    `).get(today) as { todayIn: number; todayOut: number };

    // Count low stock items (SOH < 100)
    const lowStockResult = db.prepare(`
      SELECT COUNT(*) as lowStockItems
      FROM items i
      WHERE i.is_active = 1
      AND (
        i.initial_soh +
        COALESCE((SELECT SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END) FROM transactions WHERE item_id = i.id), 0) -
        COALESCE((SELECT SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END) FROM transactions WHERE item_id = i.id), 0)
      ) < 100
    `).get() as { lowStockItems: number };

    return {
      totalItems: counts.totalItems,
      totalCategories: counts.totalCategories,
      totalCurrentSoh: sohResult.totalCurrentSoh,
      totalLotsCovered: Math.floor(sohResult.totalCurrentSoh / config.unitsPerLot * 10) / 10,
      lowStockItems: lowStockResult.lowStockItems,
      todayIn: todayResult.todayIn,
      todayOut: todayResult.todayOut,
    };
  }
}

export const reportService = new ReportService();
