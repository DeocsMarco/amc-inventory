import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '../services/inventory.service';
import { sectionsService } from '../services/sections.service';
import type { Category, SectionLot } from '../types';

export default function Inventory() {
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => inventoryService.getCategories(),
  });

  const { data: sections } = useQuery({
    queryKey: ['sections'],
    queryFn: () => sectionsService.getSections(),
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ['items-with-soh', selectedCategory],
    queryFn: () => inventoryService.getItemsWithSoh(selectedCategory),
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ itemId, sectionId }: { itemId: number; sectionId: number | null }) =>
      inventoryService.updateItem(itemId, { sectionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items-with-soh'] });
      queryClient.invalidateQueries({ queryKey: ['soh-report'] });
    },
  });

  const updateLotNumberMutation = useMutation({
    mutationFn: ({ sectionId, lotNumber }: { sectionId: number; lotNumber: number }) =>
      sectionsService.updateLotNumber(sectionId, lotNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      queryClient.invalidateQueries({ queryKey: ['items-with-soh'] });
      queryClient.invalidateQueries({ queryKey: ['soh-report'] });
    },
  });

  const handleSectionChange = (itemId: number, sectionId: number | null) => {
    updateSectionMutation.mutate({ itemId, sectionId });
  };

  const handleLotNumberChange = (sectionId: number, lotNumber: number) => {
    if (lotNumber > 0) {
      updateLotNumberMutation.mutate({ sectionId, lotNumber });
    }
  };

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

      {/* Section Lot Numbers */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Current Section Lot Numbers</h2>
        <div className="flex flex-wrap gap-4">
          {sections?.map((section: SectionLot) => (
            <div key={section.id} className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 w-20">
                {section.sectionName}:
              </label>
              <input
                type="number"
                className="input w-24 py-1 text-center"
                value={section.lotNumber}
                min={1}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value)) {
                    handleLotNumberChange(section.id, value);
                  }
                }}
                disabled={updateLotNumberMutation.isPending}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Set the current lot number for each section. Item coverage will calculate from this starting lot.
        </p>
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
                  <th>Section</th>
                  <th className="text-center">Qty/Unit</th>
                  <th className="text-center">Unit</th>
                  <th className="text-right">Initial SOH</th>
                  <th className="text-right">Current SOH</th>
                  <th className="text-right">Lots Covered</th>
                  <th className="text-right">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems?.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">{item.name}</td>
                    <td className="text-gray-600">{item.categoryName}</td>
                    <td>
                      <select
                        className="input py-1 text-sm min-w-[100px]"
                        value={item.sectionId || ''}
                        onChange={(e) => handleSectionChange(
                          item.id,
                          e.target.value ? parseInt(e.target.value) : null
                        )}
                        disabled={updateSectionMutation.isPending}
                      >
                        <option value="">-</option>
                        {sections?.map((section: SectionLot) => (
                          <option key={section.id} value={section.id}>
                            {section.sectionName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-center">{item.qtyPerUnit}</td>
                    <td className="text-center">{item.unit}</td>
                    <td className="text-right">{item.initialSoh.toLocaleString()}</td>
                    <td className="text-right font-medium">
                      <span className={item.currentSoh < 100 ? 'text-red-600' : ''}>
                        {item.currentSoh.toLocaleString()}
                      </span>
                    </td>
                    <td className="text-right">{item.lotsCovered.toFixed(1)}</td>
                    <td className="text-right text-sm">
                      {item.lotStart && item.lotEnd ? (
                        <span className="text-blue-600 font-medium">
                          {item.lotStart} - {item.lotEnd}
                        </span>
                      ) : item.sectionId ? (
                        <span className="text-gray-400">No coverage</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
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
