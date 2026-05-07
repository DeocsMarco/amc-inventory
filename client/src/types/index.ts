// Inventory Types
export interface Category {
  id: number;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface Item {
  id: number;
  categoryId: number;
  name: string;
  qtyPerUnit: number;
  unit: string;
  initialSoh: number;
  isActive: boolean;
  createdAt: string;
}

export interface ItemWithCategory extends Item {
  categoryName: string;
}

export interface ItemWithSoh extends ItemWithCategory {
  currentSoh: number;
  lotsCovered: number;
  sectionId?: number | null;
  sectionName?: string | null;
  currentLotNumber?: number | null;
  lotStart?: number | null;
  lotEnd?: number | null;
}

export interface SectionLot {
  id: number;
  sectionName: string;
  lotNumber: number;
  unitsPerLot: number;
}

export interface CreateItemDto {
  categoryId: number;
  name: string;
  qtyPerUnit?: number;
  unit?: string;
  initialSoh?: number;
}

// Transaction Types
export type TransactionType = 'IN' | 'OUT';

export interface Transaction {
  id: number;
  itemId: number;
  date: string;
  type: TransactionType;
  quantity: number;
  notes?: string;
  createdAt: string;
}

export interface TransactionWithItem extends Transaction {
  itemName: string;
  categoryName: string;
  unit: string;
}

export interface CreateTransactionDto {
  itemId: number;
  date: string;
  type: TransactionType;
  quantity: number;
  notes?: string;
}

export interface DailyTransaction {
  itemId: number;
  itemName: string;
  categoryName: string;
  unit: string;
  inQty: number;
  outQty: number;
}

// Report Types
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
  sectionId?: number | null;
  sectionName?: string | null;
  currentLotNumber?: number | null;
  lotStart?: number | null;
  lotEnd?: number | null;
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

export interface DailyMovement {
  date: string;
  day: number;
  totalIn: number;
  totalOut: number;
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

export interface DashboardStats {
  totalItems: number;
  totalCategories: number;
  totalCurrentSoh: number;
  totalLotsCovered: number;
  lowStockItems: number;
  todayIn: number;
  todayOut: number;
}
