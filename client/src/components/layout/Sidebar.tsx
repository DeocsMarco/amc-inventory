import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/inventory', label: 'Inventory', icon: '📦' },
  { path: '/daily', label: 'Daily Entry', icon: '📝' },
  { path: '/reports', label: 'Reports', icon: '📈' },
  { path: '/import', label: 'Import/Export', icon: '📁' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 text-white">
      <div className="p-6">
        <h1 className="text-xl font-bold">AMC Inventory</h1>
        <p className="text-gray-400 text-sm">Management System</p>
      </div>
      <nav className="mt-6">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
