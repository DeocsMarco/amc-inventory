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

export interface UpdateItemDto {
  categoryId?: number;
  name?: string;
  qtyPerUnit?: number;
  unit?: string;
  isActive?: boolean;
}
