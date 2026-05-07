export interface SohReport {
  itemId: number;
  itemName: string;
  categoryId: number;
  categoryName: string;
  unit: string;
  qtyPerUnit: number;
  initialSoh: number;
  totalIn: number;
  totalOut: number;
  currentSoh: number;
  lotsCovered: number;
}

export interface DailySummary {
  date: string;
  totalIn: number;
  totalOut: number;
  itemsWithMovement: number;
}

export interface CategorySummary {
  categoryId: number;
  categoryName: string;
  itemCount: number;
  totalSoh: number;
  totalLotsCovered: number;
}

export interface MonthlyReport {
  year: number;
  month: number;
  monthName: string;
  openingStock: number;
  totalIn: number;
  totalOut: number;
  closingStock: number;
  dailyMovements: DailyMovement[];
}

export interface DailyMovement {
  date: string;
  day: number;
  totalIn: number;
  totalOut: number;
}

export interface DashboardStats {
  totalItems: number;
  totalCategories: number;
  totalCurrentSoh: number;
  totalLotsCovered: number;
  lowStockItems: number;
  todayIn: number;
  todayOut: number;
}
