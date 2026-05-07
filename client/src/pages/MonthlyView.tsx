import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { inventoryService } from '../services/inventory.service';
import { transactionService } from '../services/transaction.service';
import { sectionsService } from '../services/sections.service';
import { reportService } from '../services/report.service';
import { sohService } from '../services/soh.service';
import type { Category, SectionLot, ItemWithSoh } from '../types';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function MonthlyView() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const queryClient = useQueryClient();
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

  // Queries
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => inventoryService.getCategories(),
  });

  const { data: sections } = useQuery({
    queryKey: ['sections', selectedYear, selectedMonth],
    queryFn: () => sectionsService.getSections(selectedYear, selectedMonth),
  });

  const { data: items } = useQuery({
    queryKey: ['items-with-soh'],
    queryFn: () => inventoryService.getItemsWithSoh(),
  });

  const { data: stats } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportService.getDashboardStats(),
  });

  // Get monthly opening SOH overrides
  const { data: monthlySnapshots } = useQuery({
    queryKey: ['monthly-snapshots', selectedYear, selectedMonth],
    queryFn: () => sohService.getMonthlySnapshots(selectedYear, selectedMonth),
  });

  // Create a map of item_id -> opening_soh for the month
  const monthlyOpeningSoh = new Map<number, number>();
  for (const snapshot of monthlySnapshots || []) {
    monthlyOpeningSoh.set(snapshot.item_id, snapshot.opening_soh);
  }

  // Get all transactions for the month
  const { data: monthlyTransactions } = useQuery({
    queryKey: ['monthly-transactions', selectedYear, selectedMonth],
    queryFn: async () => {
      const transactions: Record<string, number> = {};
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatDate(selectedYear, selectedMonth, day);
        const daily = await transactionService.getDailyTransactions(dateStr);
        for (const t of daily) {
          if (t.inQty > 0) {
            transactions[`${t.itemId}-${day}-IN`] = t.inQty;
          }
          if (t.outQty > 0) {
            transactions[`${t.itemId}-${day}-OUT`] = t.outQty;
          }
        }
      }
      return transactions;
    },
  });

  // Mutations
  const transactionMutation = useMutation({
    mutationFn: (data: { itemId: number; date: string; type: 'IN' | 'OUT'; quantity: number }) =>
      transactionService.upsertTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['items-with-soh'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Saved');
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ itemId, sectionId }: { itemId: number; sectionId: number | null }) =>
      inventoryService.updateItem(itemId, { sectionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items-with-soh'] });
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
  });

  const updateLotNumberMutation = useMutation({
    mutationFn: ({ sectionId, lotNumber, year, month }: { sectionId: number; lotNumber: number; year: number; month: number }) =>
      sectionsService.updateLotNumber(sectionId, lotNumber, year, month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      queryClient.invalidateQueries({ queryKey: ['items-with-soh'] });
    },
  });

  const updateOpeningSohMutation = useMutation({
    mutationFn: ({ itemId, openingSoh }: { itemId: number; openingSoh: number }) =>
      sohService.setMonthlyOpeningSoh(itemId, selectedYear, selectedMonth, openingSoh),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['items-with-soh'] });
      toast.success('Opening SOH updated');
    },
  });

  // Group items by category
  const itemsByCategory = new Map<number, ItemWithSoh[]>();
  for (const item of items || []) {
    const catItems = itemsByCategory.get(item.categoryId) || [];
    catItems.push(item);
    itemsByCategory.set(item.categoryId, catItems);
  }

  // Handle cell edit - supports IN/OUT transactions and "initial" for opening SOH
  const handleCellClick = (itemId: number, day: number | 'initial', type: 'IN' | 'OUT' | 'initial', currentValue: number) => {
    const key = `${itemId}-${day}-${type}`;
    setEditingCell(key);
    setEditValue(currentValue > 0 ? String(currentValue) : '');
  };

  const handleCellBlur = useCallback(() => {
    if (!editingCell) return;

    const parts = editingCell.split('-');
    const itemId = parseInt(parts[0]);
    const dayOrType = parts[1];
    const type = parts[2];

    // Handle opening SOH edit
    if (dayOrType === 'initial') {
      const openingSoh = parseInt(editValue) || 0;
      updateOpeningSohMutation.mutate({ itemId, openingSoh });
    } else {
      // Handle transaction edit
      const day = parseInt(dayOrType);
      const quantity = parseInt(editValue) || 0;
      const dateStr = formatDate(selectedYear, selectedMonth, day);

      transactionMutation.mutate({
        itemId,
        date: dateStr,
        type: type as 'IN' | 'OUT',
        quantity,
      });
    }

    setEditingCell(null);
    setEditValue('');
  }, [editingCell, editValue, selectedYear, selectedMonth, transactionMutation, updateOpeningSohMutation]);

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleExport = () => {
    window.open(`/api/export/xlsx?year=${selectedYear}&month=${selectedMonth}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Daily Inventory / Monitoring</h1>
        <button onClick={handleExport} className="btn btn-primary">
          Export to Excel
        </button>
      </div>

      {/* Month/Year Selector + Stats */}
      <div className="card">
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              className="input"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select
              className="input"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {monthNames.map((month, index) => (
                <option key={month} value={index + 1}>{month}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-6 ml-auto text-sm">
            <div>
              <span className="text-gray-500">Total Items:</span>
              <span className="font-bold ml-2">{stats?.totalItems || 0}</span>
            </div>
            <div>
              <span className="text-gray-500">Total SOH:</span>
              <span className="font-bold ml-2">{stats?.totalCurrentSoh?.toLocaleString() || 0}</span>
            </div>
            <div>
              <span className="text-gray-500">Today IN:</span>
              <span className="font-bold ml-2 text-green-600">{stats?.todayIn?.toLocaleString() || 0}</span>
            </div>
            <div>
              <span className="text-gray-500">Today OUT:</span>
              <span className="font-bold ml-2 text-red-600">{stats?.todayOut?.toLocaleString() || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section Lot Numbers */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-center">
          <span className="text-sm font-medium text-gray-700">
            Section Lot Numbers for {monthNames[selectedMonth - 1]} {selectedYear}:
          </span>
          {sections?.map((section: SectionLot) => (
            <div key={section.id} className="flex items-center gap-2">
              <span className="text-sm font-medium">{section.sectionName}:</span>
              <input
                type="number"
                className="input w-20 py-1 text-center text-sm"
                value={section.lotNumber}
                min={1}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value > 0) {
                    updateLotNumberMutation.mutate({
                      sectionId: section.id,
                      lotNumber: value,
                      year: selectedYear,
                      month: selectedMonth,
                    });
                  }
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Main Spreadsheet Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-2 text-left sticky left-0 bg-gray-100 z-10 min-w-[200px]">
                Item Name
              </th>
              <th className="border border-gray-300 px-2 py-2 text-center w-16">Qty/Unit</th>
              <th className="border border-gray-300 px-2 py-2 text-center w-12">Unit</th>
              <th className="border-2 border-yellow-500 px-2 py-2 text-center w-24 bg-yellow-200 font-bold text-yellow-800">Opening</th>
              <th className="border border-gray-300 px-2 py-2 text-center w-12">I/O</th>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <th key={i} className="border border-gray-300 px-1 py-2 text-center w-12 text-xs">
                  {i + 1}
                </th>
              ))}
              <th className="border border-gray-300 px-2 py-2 text-center w-20">Total SOH</th>
              <th className="border border-gray-300 px-2 py-2 text-center w-14">Lots</th>
              <th className="border border-gray-300 px-2 py-2 text-center w-20">Section</th>
              <th className="border border-gray-300 px-2 py-2 text-center w-20">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {categories?.map((category: Category) => {
              const catItems = itemsByCategory.get(category.id) || [];
              if (catItems.length === 0) return null;

              return (
                <CategorySection
                  key={category.id}
                  category={category}
                  items={catItems}
                  daysInMonth={daysInMonth}
                  monthlyTransactions={monthlyTransactions || {}}
                  monthlyOpeningSoh={monthlyOpeningSoh}
                  sections={sections || []}
                  editingCell={editingCell}
                  editValue={editValue}
                  setEditValue={setEditValue}
                  onCellClick={handleCellClick}
                  onCellBlur={handleCellBlur}
                  onCellKeyDown={handleCellKeyDown}
                  onSectionChange={(itemId, sectionId) => updateSectionMutation.mutate({ itemId, sectionId })}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategorySection({
  category,
  items,
  daysInMonth,
  monthlyTransactions,
  monthlyOpeningSoh,
  sections,
  editingCell,
  editValue,
  setEditValue,
  onCellClick,
  onCellBlur,
  onCellKeyDown,
  onSectionChange,
}: {
  category: Category;
  items: ItemWithSoh[];
  daysInMonth: number;
  monthlyTransactions: Record<string, number>;
  monthlyOpeningSoh: Map<number, number>;
  sections: SectionLot[];
  editingCell: string | null;
  editValue: string;
  setEditValue: (value: string) => void;
  onCellClick: (itemId: number, day: number | 'initial', type: 'IN' | 'OUT' | 'initial', currentValue: number) => void;
  onCellBlur: () => void;
  onCellKeyDown: (e: React.KeyboardEvent) => void;
  onSectionChange: (itemId: number, sectionId: number | null) => void;
}) {
  const totalCols = 5 + daysInMonth + 4;

  return (
    <>
      {/* Category Header */}
      <tr className="bg-blue-600 text-white">
        <td colSpan={totalCols} className="border border-gray-300 px-2 py-1 font-bold">
          {category.name}
        </td>
      </tr>

      {/* Items */}
      {items.map((item) => (
        <ItemRows
          key={item.id}
          item={item}
          daysInMonth={daysInMonth}
          monthlyTransactions={monthlyTransactions}
          monthlyOpeningSoh={monthlyOpeningSoh}
          sections={sections}
          editingCell={editingCell}
          editValue={editValue}
          setEditValue={setEditValue}
          onCellClick={onCellClick}
          onCellBlur={onCellBlur}
          onCellKeyDown={onCellKeyDown}
          onSectionChange={onSectionChange}
        />
      ))}
    </>
  );
}

function ItemRows({
  item,
  daysInMonth,
  monthlyTransactions,
  monthlyOpeningSoh,
  sections,
  editingCell,
  editValue,
  setEditValue,
  onCellClick,
  onCellBlur,
  onCellKeyDown,
  onSectionChange,
}: {
  item: ItemWithSoh;
  daysInMonth: number;
  monthlyTransactions: Record<string, number>;
  monthlyOpeningSoh: Map<number, number>;
  sections: SectionLot[];
  editingCell: string | null;
  editValue: string;
  setEditValue: (value: string) => void;
  onCellClick: (itemId: number, day: number | 'initial', type: 'IN' | 'OUT' | 'initial', currentValue: number) => void;
  onCellBlur: () => void;
  onCellKeyDown: (e: React.KeyboardEvent) => void;
  onSectionChange: (itemId: number, sectionId: number | null) => void;
}) {
  // Get the opening SOH - use monthly override if available, otherwise use item's initial SOH
  const openingSoh = monthlyOpeningSoh.get(item.id) ?? item.initialSoh;
  const isEditingOpening = editingCell === `${item.id}-initial-initial`;

  return (
    <>
      {/* IN Row */}
      <tr className="hover:bg-gray-50">
        <td className="border border-gray-300 px-2 py-1 font-medium sticky left-0 bg-white">
          {item.name}
        </td>
        <td className="border border-gray-300 px-2 py-1 text-center">{item.qtyPerUnit}</td>
        <td className="border border-gray-300 px-2 py-1 text-center">{item.unit}</td>
        <td
          className="border-2 border-yellow-400 px-2 py-1 text-right bg-yellow-100 cursor-pointer hover:bg-yellow-200"
          onClick={() => !isEditingOpening && onCellClick(item.id, 'initial', 'initial', openingSoh)}
        >
          {isEditingOpening ? (
            <input
              type="number"
              className="w-full h-8 text-right text-base font-bold bg-white border-2 border-blue-500 rounded px-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={onCellBlur}
              onKeyDown={onCellKeyDown}
              autoFocus
              min={0}
            />
          ) : (
            <span className="font-bold text-yellow-800">{openingSoh.toLocaleString()}</span>
          )}
        </td>
        <td className="border border-gray-300 px-2 py-1 text-center font-bold text-green-600">IN</td>
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = `${item.id}-${day}-IN`;
          const value = monthlyTransactions[key] || 0;
          const isEditing = editingCell === key;

          return (
            <td
              key={day}
              className="border border-gray-300 px-1 py-1 text-center cursor-pointer hover:bg-green-100"
              onClick={() => !isEditing && onCellClick(item.id, day, 'IN', value)}
            >
              {isEditing ? (
                <input
                  type="number"
                  className="w-14 h-8 text-center text-base font-bold bg-green-50 border-2 border-green-500 rounded focus:outline-none focus:ring-2 focus:ring-green-300"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={onCellBlur}
                  onKeyDown={onCellKeyDown}
                  autoFocus
                  min={0}
                />
              ) : (
                <span className={value > 0 ? 'text-green-600 font-bold' : 'text-gray-300'}>
                  {value > 0 ? value : '-'}
                </span>
              )}
            </td>
          );
        })}
        <td className="border border-gray-300 px-2 py-1 text-right font-bold">
          {item.currentSoh.toLocaleString()}
        </td>
        <td className="border border-gray-300 px-2 py-1 text-center">
          {item.lotsCovered.toFixed(1)}
        </td>
        <td className="border border-gray-300 px-1 py-1">
          <select
            className="w-full text-xs border-0 bg-transparent"
            value={item.sectionId || ''}
            onChange={(e) => onSectionChange(item.id, e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">-</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.sectionName}</option>
            ))}
          </select>
        </td>
        <td className="border border-gray-300 px-2 py-1 text-center text-blue-600 font-medium text-xs">
          {item.lotStart && item.lotEnd ? `${item.lotStart}-${item.lotEnd}` : '-'}
        </td>
      </tr>

      {/* OUT Row */}
      <tr className="hover:bg-gray-50">
        <td className="border border-gray-300 px-2 py-1 sticky left-0 bg-white"></td>
        <td className="border border-gray-300 px-2 py-1"></td>
        <td className="border border-gray-300 px-2 py-1"></td>
        <td className="border-2 border-yellow-400 px-2 py-1 bg-yellow-100"></td>
        <td className="border border-gray-300 px-2 py-1 text-center font-bold text-red-600">OUT</td>
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = `${item.id}-${day}-OUT`;
          const value = monthlyTransactions[key] || 0;
          const isEditing = editingCell === key;

          return (
            <td
              key={day}
              className="border border-gray-300 px-1 py-1 text-center cursor-pointer hover:bg-red-100"
              onClick={() => !isEditing && onCellClick(item.id, day, 'OUT', value)}
            >
              {isEditing ? (
                <input
                  type="number"
                  className="w-14 h-8 text-center text-base font-bold bg-red-50 border-2 border-red-500 rounded focus:outline-none focus:ring-2 focus:ring-red-300"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={onCellBlur}
                  onKeyDown={onCellKeyDown}
                  autoFocus
                  min={0}
                />
              ) : (
                <span className={value > 0 ? 'text-red-600 font-bold' : 'text-gray-300'}>
                  {value > 0 ? value : '-'}
                </span>
              )}
            </td>
          );
        })}
        <td className="border border-gray-300 px-2 py-1"></td>
        <td className="border border-gray-300 px-2 py-1"></td>
        <td className="border border-gray-300 px-2 py-1"></td>
        <td className="border border-gray-300 px-2 py-1"></td>
      </tr>
    </>
  );
}
