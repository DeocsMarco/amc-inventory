import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '../services/inventory.service';
import type { Category } from '../types';

export default function Inventory() {
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => inventoryService.getCategories(),
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ['items-with-soh', selectedCategory],
    queryFn: () => inventoryService.getItemsWithSoh(selectedCategory),
  });

  const filteredItems = items?.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              className="input"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-64">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              className="input"
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : undefined)}
            >
              <option value="">All Categories</option>
              {categories?.map((cat: Category) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th className="text-center">Qty/Unit</th>
                  <th className="text-center">Unit</th>
                  <th className="text-right">Initial SOH</th>
                  <th className="text-right">Current SOH</th>
                  <th className="text-right">Lots Covered</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems?.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">{item.name}</td>
                    <td className="text-gray-600">{item.categoryName}</td>
                    <td className="text-center">{item.qtyPerUnit}</td>
                    <td className="text-center">{item.unit}</td>
                    <td className="text-right">{item.initialSoh.toLocaleString()}</td>
                    <td className="text-right font-medium">
                      <span className={item.currentSoh < 100 ? 'text-red-600' : ''}>
                        {item.currentSoh.toLocaleString()}
                      </span>
                    </td>
                    <td className="text-right">{item.lotsCovered.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredItems?.length === 0 && (
              <p className="text-center text-gray-500 py-8">No items found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
