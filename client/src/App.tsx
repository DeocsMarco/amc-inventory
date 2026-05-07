import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import MonthlyView from './pages/MonthlyView';
import Reports from './pages/Reports';
import Import from './pages/Import';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<MonthlyView />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/import" element={<Import />} />
      </Routes>
    </Layout>
  );
}

export default App;
