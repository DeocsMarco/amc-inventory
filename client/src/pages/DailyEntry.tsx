import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { inventoryService } from '../services/inventory.service';
import { transactionService } from '../services/transaction.service';
import type { CreateTransactionDto } from '@amc/shared';

export default function DailyEntry() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedItem, setSelectedItem] = useState<number | ''>('');
  const [transactionType, setTransactionType] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState('');

  const queryClient = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: () => inventoryService.getItems(),
  });

  const { data: dailyTransactions, isLoading } = useQuery({
    queryKey: ['daily-transactions', selectedDate],
    queryFn: () => transactionService.getDailyTransactions(selectedDate),
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateTransactionDto) => transactionService.upsertTransaction(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Transaction recorded');
      setSelectedItem('');
      setQuantity('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !quantity) {
      toast.error('Please select an item and enter quantity');
      return;
    }

    createMutation.mutate({
      itemId: selectedItem as number,
      date: selectedDate,
      type: transactionType,
      quantity: parseFloat(quantity),
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Daily Entry</h1>

      {/* Date Selector */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Date
        </label>
        <input
          type="date"
          className="input w-auto"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {/* Transaction Form */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Record Transaction</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item
              </label>
              <select
                className="input"
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value ? parseInt(e.target.value) : '')}
              >
                <option value="">Select an item...</option>
                {items?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.categoryName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                    transactionType === 'IN'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                  onClick={() => setTransactionType('IN')}
                >
                  IN
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                    transactionType === 'OUT'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                  onClick={() => setTransactionType('OUT')}
                >
                  OUT
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                className="input"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="0"
                step="1"
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Recording...' : 'Record Transaction'}
          </button>
        </form>
      </div>

      {/* Daily Transactions */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">
          Transactions for {format(new Date(selectedDate), 'MMMM d, yyyy')}
        </h2>
        {isLoading ? (
          <div className="flex justify-center items-center h-32">Loading...</div>
        ) : dailyTransactions && dailyTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="text-center">Unit</th>
                  <th className="text-right text-green-600">IN</th>
                  <th className="text-right text-red-600">OUT</th>
                </tr>
              </thead>
              <tbody>
                {dailyTransactions.map((t) => (
                  <tr key={t.itemId}>
                    <td className="font-medium">{t.itemName}</td>
                    <td className="text-gray-600">{t.categoryName}</td>
                    <td className="text-center">{t.unit}</td>
                    <td className="text-right text-green-600 font-medium">
                      {t.inQty > 0 ? t.inQty.toLocaleString() : '-'}
                    </td>
                    <td className="text-right text-red-600 font-medium">
                      {t.outQty > 0 ? t.outQty.toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">No transactions for this date</p>
        )}
      </div>
    </div>
  );
}
