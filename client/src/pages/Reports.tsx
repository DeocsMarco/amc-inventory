import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { reportService } from '../services/report.service';

export default function Reports() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const { data: monthlyReport, isLoading } = useQuery({
    queryKey: ['monthly-report', selectedYear, selectedMonth],
    queryFn: () => reportService.getMonthlyReport(selectedYear, selectedMonth),
  });

  const { data: sohReport } = useQuery({
    queryKey: ['soh-report'],
    queryFn: () => reportService.getSohReport(),
  });

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Prepare chart data
  const chartData = monthlyReport?.dailyMovements.map((d) => ({
    day: d.day,
    IN: d.totalIn,
    OUT: d.totalOut,
  })) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

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
              {[2023, 2024, 2025, 2026].map((year) => (
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

      {/* Monthly Summary */}
      {isLoading ? (
        <div className="card flex justify-center items-center h-64">Loading...</div>
      ) : monthlyReport && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <SummaryCard label="Opening Stock" value={monthlyReport.openingStock} />
            <SummaryCard label="Total IN" value={monthlyReport.totalIn} color="green" />
            <SummaryCard label="Total OUT" value={monthlyReport.totalOut} color="red" />
            <SummaryCard label="Closing Stock" value={monthlyReport.closingStock} />
          </div>

          {/* Daily Movement Chart */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">
              Daily Movement - {monthlyReport.monthName} {monthlyReport.year}
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="IN" fill="#22c55e" name="IN" />
                  <Bar dataKey="OUT" fill="#ef4444" name="OUT" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* SOH Report */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Current Stock on Hand</h2>
        <div className="overflow-x-auto max-h-96">
          <table className="table">
            <thead className="sticky top-0 bg-gray-100">
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th className="text-right">Initial SOH</th>
                <th className="text-right">Total IN</th>
                <th className="text-right">Total OUT</th>
                <th className="text-right">Current SOH</th>
                <th className="text-right">Lots</th>
              </tr>
            </thead>
            <tbody>
              {sohReport?.map((item) => (
                <tr key={item.itemId}>
                  <td className="font-medium">{item.itemName}</td>
                  <td className="text-gray-600 text-sm">{item.categoryName}</td>
                  <td className="text-right">{item.initialSoh.toLocaleString()}</td>
                  <td className="text-right text-green-600">{item.totalIn.toLocaleString()}</td>
                  <td className="text-right text-red-600">{item.totalOut.toLocaleString()}</td>
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
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: 'green' | 'red';
}) {
  const colorClass = color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' : '';

  return (
    <div className="card">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value.toLocaleString()}</p>
    </div>
  );
}
