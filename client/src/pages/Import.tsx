import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { reportService } from '../services/report.service';

export default function Import() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    categoriesCreated: number;
    itemsCreated: number;
    itemsUpdated: number;
    transactionsCreated: number;
    sheetsProcessed: string[];
  } | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [exportYear, setExportYear] = useState(currentYear);
  const [exportMonth, setExportMonth] = useState(currentMonth);

  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (file: File) => reportService.importXlsx(file),
    onSuccess: (result) => {
      setImportResult(result);
      setSelectedFile(null);
      queryClient.invalidateQueries();
      toast.success('Import completed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  const handleExport = () => {
    const url = reportService.getExportUrl(exportYear, exportMonth);
    window.open(url, '_blank');
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Import / Export</h1>

      {/* Import Section */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Import from Excel</h2>
        <p className="text-gray-600 mb-4">
          Upload an Excel file (.xlsx) to import inventory data. The file should match the
          standard inventory monitoring format with monthly sheets.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Excel File
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
          </div>

          {selectedFile && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Selected: {selectedFile.name}
              </span>
              <button
                onClick={handleImport}
                disabled={importMutation.isPending}
                className="btn btn-primary"
              >
                {importMutation.isPending ? 'Importing...' : 'Import'}
              </button>
            </div>
          )}

          {importResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-medium text-green-800 mb-2">Import Complete</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>Sheets processed: {importResult.sheetsProcessed.join(', ')}</li>
                <li>Categories created: {importResult.categoriesCreated}</li>
                <li>Items created: {importResult.itemsCreated}</li>
                <li>Items updated: {importResult.itemsUpdated}</li>
                <li>Transactions created: {importResult.transactionsCreated}</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Export Section */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Export to Excel</h2>
        <p className="text-gray-600 mb-4">
          Export inventory data for a specific month to an Excel file.
        </p>

        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              className="input"
              value={exportYear}
              onChange={(e) => setExportYear(parseInt(e.target.value))}
            >
              {[2023, 2024, 2025, 2026].map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select
              className="input"
              value={exportMonth}
              onChange={(e) => setExportMonth(parseInt(e.target.value))}
            >
              {months.map((month, index) => (
                <option key={month} value={index + 1}>{month}</option>
              ))}
            </select>
          </div>
          <button onClick={handleExport} className="btn btn-primary">
            Download Excel
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="card bg-blue-50 border border-blue-200">
        <h2 className="text-lg font-semibold text-blue-800 mb-2">File Format</h2>
        <p className="text-sm text-blue-700 mb-2">
          The import expects an Excel file with the following structure:
        </p>
        <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
          <li>Monthly sheets (e.g., June, July, August, etc.)</li>
          <li>Date headers in row 8, columns I onwards</li>
          <li>Category headers without unit info</li>
          <li>Items with 3-row structure: Name/SOH/IN row, OUT row, separator</li>
          <li>Column A: Item name, Column E: Qty per unit, Column F: Unit</li>
          <li>Column G: Starting SOH, Column H: IN/OUT indicator</li>
        </ul>
      </div>
    </div>
  );
}
