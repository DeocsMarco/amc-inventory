import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { sohService, type MonthlySnapshot, type SohAdjustment } from '../services/soh.service';
import { inventoryService } from '../services/inventory.service';
import type { ItemWithSoh } from '../types';

export default function SohManagement() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [activeTab, setActiveTab] = useState<'monthly' | 'adjust'>('monthly');

  // For adjustment form
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [newSoh, setNewSoh] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  const queryClient = useQueryClient();

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Queries
  const { data: items } = useQuery({
    queryKey: ['items-with-soh'],
    queryFn: () => inventoryService.getItems(),
  });

  const { data: snapshots, isLoading: loadingSnapshots } = useQuery({
    queryKey: ['monthly-snapshots', selectedYear, selectedMonth],
    queryFn: () => sohService.getMonthlySnapshots(selectedYear, selectedMonth),
  });

  const { data: adjustments, isLoading: loadingAdjustments } = useQuery({
    queryKey: ['adjustments'],
    queryFn: () => sohService.getAdjustments(undefined, 100),
  });

  // Mutations
  const updateMonthlySoh = useMutation({
    mutationFn: ({ itemId, openingSoh }: { itemId: number; openingSoh: number }) =>
      sohService.setMonthlyOpeningSoh(itemId, selectedYear, selectedMonth, openingSoh),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-snapshots'] });
      toast.success('Opening SOH updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const createAdjustment = useMutation({
    mutationFn: () =>
      sohService.createAdjustment(
        selectedItemId!,
        adjustmentDate,
        parseFloat(newSoh),
        adjustmentReason || undefined
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Adjustment created');
      setSelectedItemId(null);
      setNewSoh('');
      setAdjustmentReason('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Create a map of item_id -> snapshot for easy lookup
  const snapshotMap = new Map<number, MonthlySnapshot>();
  for (const snap of snapshots || []) {
    snapshotMap.set(snap.item_id, snap);
  }

  const handleSohChange = (itemId: number, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      updateMonthlySoh.mutate({ itemId, openingSoh: numValue });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Stock on Hand Management</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'monthly'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Monthly Opening SOH
          </button>
          <button
            onClick={() => setActiveTab('adjust')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'adjust'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Manual Adjustments
          </button>
        </nav>
      </div>

      {activeTab === 'monthly' && (
        <>
          {/* Month Selector */}
          <div className="card">
            <div className="flex gap-4 items-end">
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
                  {months.map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Monthly SOH Table */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">
              Opening Stock on Hand - {months[selectedMonth - 1]} {selectedYear}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Set the opening stock for each item at the beginning of the month.
              This overrides the calculated SOH from transactions.
            </p>

            {loadingSnapshots ? (
              <div className="flex justify-center py-8">Loading...</div>
            ) : (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="table">
                  <thead className="sticky top-0 bg-gray-100">
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th className="text-right w-40">Opening SOH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(items as ItemWithSoh[])?.map((item) => {
                      const snapshot = snapshotMap.get(item.id);
                      return (
                        <tr key={item.id}>
                          <td className="font-medium">{item.name}</td>
                          <td className="text-gray-600 text-sm">{item.categoryName}</td>
                          <td className="text-right">
                            <input
                              type="number"
                              className="input w-32 text-right"
                              defaultValue={snapshot?.opening_soh ?? ''}
                              placeholder={item.initialSoh?.toString() || '0'}
                              onBlur={(e) => handleSohChange(item.id, e.target.value)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'adjust' && (
        <>
          {/* Adjustment Form */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Create SOH Adjustment</h2>
            <p className="text-sm text-gray-500 mb-4">
              Manually adjust the stock on hand for an item. Use this to correct discrepancies
              found during physical inventory counts.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                <select
                  className="input"
                  value={selectedItemId || ''}
                  onChange={(e) => setSelectedItemId(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">Select an item...</option>
                  {(items as ItemWithSoh[])?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  className="input"
                  value={adjustmentDate}
                  onChange={(e) => setAdjustmentDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New SOH</label>
                <input
                  type="number"
                  className="input"
                  value={newSoh}
                  onChange={(e) => setNewSoh(e.target.value)}
                  placeholder="Enter new SOH value"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  className="input"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Physical count, correction, etc."
                />
              </div>
            </div>

            <div className="mt-4">
              <button
                className="btn btn-primary"
                disabled={!selectedItemId || !newSoh || createAdjustment.isPending}
                onClick={() => createAdjustment.mutate()}
              >
                {createAdjustment.isPending ? 'Creating...' : 'Create Adjustment'}
              </button>
            </div>
          </div>

          {/* Adjustment History */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Adjustment History</h2>

            {loadingAdjustments ? (
              <div className="flex justify-center py-8">Loading...</div>
            ) : (
              <div className="overflow-x-auto max-h-[400px]">
                <table className="table">
                  <thead className="sticky top-0 bg-gray-100">
                    <tr>
                      <th>Date</th>
                      <th>Item</th>
                      <th className="text-right">Previous SOH</th>
                      <th className="text-right">New SOH</th>
                      <th className="text-right">Adjustment</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(adjustments as SohAdjustment[])?.map((adj) => (
                      <tr key={adj.id}>
                        <td>{new Date(adj.date).toLocaleDateString()}</td>
                        <td className="font-medium">{adj.items?.name}</td>
                        <td className="text-right">{adj.previous_soh.toLocaleString()}</td>
                        <td className="text-right">{adj.new_soh.toLocaleString()}</td>
                        <td className={`text-right font-medium ${adj.adjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {adj.adjustment >= 0 ? '+' : ''}{adj.adjustment.toLocaleString()}
                        </td>
                        <td className="text-gray-600 text-sm">{adj.reason || '-'}</td>
                      </tr>
                    ))}
                    {(!adjustments || adjustments.length === 0) && (
                      <tr>
                        <td colSpan={6} className="text-center text-gray-500 py-8">
                          No adjustments yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
