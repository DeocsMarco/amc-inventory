import { useQuery } from '@tanstack/react-query';
import { reportService } from '../services/report.service';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportService.getDashboardStats(),
  });

  const { data: categories } = useQuery({
    queryKey: ['category-summary'],
    queryFn: () => reportService.getCategorySummary(),
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Items"
          value={stats?.totalItems || 0}
          icon="📦"
        />
        <StatCard
          label="Total Stock"
          value={stats?.totalCurrentSoh?.toLocaleString() || 0}
          icon="📊"
        />
        <StatCard
          label="Today's IN"
          value={stats?.todayIn?.toLocaleString() || 0}
          icon="📥"
          color="green"
        />
        <StatCard
          label="Today's OUT"
          value={stats?.todayOut?.toLocaleString() || 0}
          icon="📤"
          color="red"
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Categories"
          value={stats?.totalCategories || 0}
          icon="📁"
        />
        <StatCard
          label="Lots Covered"
          value={stats?.totalLotsCovered?.toFixed(1) || 0}
          icon="📋"
        />
        <StatCard
          label="Low Stock Items"
          value={stats?.lowStockItems || 0}
          icon="⚠️"
          color={stats?.lowStockItems && stats.lowStockItems > 0 ? 'yellow' : undefined}
        />
      </div>

      {/* Category Summary */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Category Summary</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="text-right">Items</th>
                <th className="text-right">Total SOH</th>
                <th className="text-right">Lots Covered</th>
              </tr>
            </thead>
            <tbody>
              {categories?.map((cat) => (
                <tr key={cat.categoryId}>
                  <td className="font-medium">{cat.categoryName}</td>
                  <td className="text-right">{cat.itemCount}</td>
                  <td className="text-right">{cat.totalSoh.toLocaleString()}</td>
                  <td className="text-right">{cat.totalLotsCovered.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: string;
  color?: 'green' | 'red' | 'yellow';
}) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
  };

  return (
    <div className={`card border ${color ? colorClasses[color] : 'border-gray-200'}`}>
      <div className="flex items-center gap-4">
        <span className="text-3xl">{icon}</span>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}
