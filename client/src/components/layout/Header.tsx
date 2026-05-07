import { format } from 'date-fns';

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Today</p>
          <p className="font-medium">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="btn btn-secondary text-sm">
            Refresh Data
          </button>
        </div>
      </div>
    </header>
  );
}
