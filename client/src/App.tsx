import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import DailyEntry from './pages/DailyEntry';
import Reports from './pages/Reports';
import Import from './pages/Import';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/daily" element={<DailyEntry />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/import" element={<Import />} />
      </Routes>
    </Layout>
  );
}

export default App;
