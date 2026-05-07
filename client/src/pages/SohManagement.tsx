import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { sohService, type MonthlySnapshot, type SohAdjustment, type SohChangePreview } from '../services/soh.service';
import { inventoryService } from '../services/inventory.service';
import type { ItemWithSoh } from '../types';

export default function SohManagement() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [activeTab, setActiveTab] = useState<'monthly' | 'adjust'>('monthly');

  // For SOH change preview modal
  const [pendingChange, setPendingChange] = useState<{
    itemId: number;
    itemName: string;
    newValue: number;
  } | null>(null);
  const [preview, setPreview] = useState<SohChangePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Opening SOH updated');
      setPendingChange(null);
      setPreview(null);
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
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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

  const handleSohChange = async (itemId: number, itemName: string, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    // Show preview before applying
    setPendingChange({ itemId, itemName, newValue: numValue });
    setLoadingPreview(true);

    try {
      const previewData = await sohService.previewSohChange(itemId, selectedYear, selectedMonth, numValue);
      setPreview(previewData);
    } catch (error) {
      toast.error('Failed to load preview');
      setPendingChange(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const confirmChange = () => {
    if (pendingChange) {
      updateMonthlySoh.mutate({ itemId: pendingChange.itemId, openingSoh: pendingChange.newValue });
    }
  };

  const cancelChange = () => {
    setPendingChange(null);
    setPreview(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Stock on Hand Management</h1>

      {/* Preview Modal */}
      {pendingChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Confirm SOH Change</h3>

            {loadingPreview ? (
              <div className="py-8 text-center text-gray-500">Loading preview...</div>
            ) : preview ? (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded p-4">
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>{preview.itemName}</strong> - {months[selectedMonth - 1]} {selectedYear}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Current Opening SOH:</div>
                    <div className="text-right font-medium">{preview.currentOpeningSoh.toLocaleString()}</div>

                    <div>New Opening SOH:</div>
                    <div className="text-right font-medium text-blue-600">{preview.newOpeningSoh.toLocaleString()}</div>
                  </div>
                </div>

                {preview.difference !== 0 && (
                  <div className={`rounded p-4 ${preview.difference > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <p className="text-sm font-medium mb-2">Impact on Current Stock:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Current SOH now:</div>
                      <div className="text-right">{preview.currentSohNow.toLocaleString()}</div>

                      <div>After this change:</div>
                      <div className={`text-right font-bold ${preview.difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {preview.projectedSohAfterChange.toLocaleString()}
                      </div>

                      <div>Difference:</div>
                      <div className={`text-right font-bold ${preview.difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {preview.difference > 0 ? '+' : ''}{preview.difference.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                {preview.difference === 0 && (
                  <div className="bg-gray-50 rounded p-4 text-sm text-gray-600">
                    No change to current stock levels.
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex gap-3 mt-6">
              <button
                className="btn flex-1"
                onClick={cancelChange}
                disabled={updateMonthlySoh.isPending}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary flex-1"
                onClick={confirmChange}
                disabled={loadingPreview || updateMonthlySoh.isPending}
              >
                {updateMonthlySoh.isPending ? 'Saving...' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              Changes will show a preview of how current stock will be affected.
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
                      <th className="text-right">Current SOH</th>
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
                          <td className="text-right text-gray-600">{item.currentSoh?.toLocaleString() || 0}</td>
                          <td className="text-right">
                            <input
                              type="number"
                              className="input w-32 text-right"
                              defaultValue={snapshot?.opening_soh ?? ''}
                              placeholder={item.initialSoh?.toString() || '0'}
                              onBlur={(e) => {
                                const val = e.target.value;
                                if (val && val !== (snapshot?.opening_soh?.toString() ?? '')) {
                                  handleSohChange(item.id, item.name, val);
                                }
                              }}
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
